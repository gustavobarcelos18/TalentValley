using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Services;
using TalentValley.Api.Storage;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false)));
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuditoriaService>();
builder.Services.AddScoped<AdminAccountService>();
builder.Services.AddScoped<AlunoDeletionService>();
builder.Services.AddScoped<RecrutadorDeletionService>();
builder.Services.AddScoped<AdminAlunoService>();
builder.Services.AddScoped<AdminRecrutadorService>();
builder.Services.AddScoped<AdminRpvValidationService>();
builder.Services.AddScoped<AdminDashboardService>();
builder.Services.AddScoped<SolicitacaoCadastroService>();

builder.Services.AddScoped<SlugService>();
builder.Services.AddScoped<AlunoService>();
builder.Services.AddScoped<StudentFileService>();
builder.Services.AddSingleton<FileUploadValidator>();
builder.Services.Configure<StorageOptions>(builder.Configuration.GetSection(StorageOptions.SectionName));
builder.Services.AddSingleton<IFileStorage, LocalFileStorage>();
builder.Services.AddScoped<FormacaoService>();
builder.Services.AddScoped<ExperienciaService>();
builder.Services.AddScoped<ProjetoService>();
builder.Services.AddScoped<TrajetoriaService>();
builder.Services.AddScoped<TalentDiscoveryService>();
builder.Services.AddScoped<TalentFileService>();
builder.Services.AddScoped<FavoriteService>();
builder.Services.AddScoped<TalentComparisonService>();
builder.Services.AddScoped<RecruiterDashboardService>();
builder.Services.AddScoped<CatalogSeedService>();
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
    context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier);
builder.Services.AddOpenApi();
builder.Services.AddApplicationDatabase(builder.Configuration, builder.Environment);
builder.Services.AddApplicationSecurity(builder.Configuration, builder.Environment);
builder.Services.AddRateLimiter(options =>
{
    // Fixed window per client IP and endpoint, for anonymous endpoints open to abuse.
    var permitLimit = builder.Configuration.GetValue("RateLimiting:PermitLimit", 5);
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = (context, _) =>
    {
        context.HttpContext.Response.Headers.RetryAfter = "60";
        return ValueTask.CompletedTask;
    };
    options.AddPolicy(RateLimitPolicies.Anonymous, context => RateLimitPartition.GetFixedWindowLimiter(
        $"{context.Connection.RemoteIpAddress}|{context.Request.Path}",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = permitLimit, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    var database = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (app.Configuration.GetValue<bool>("Deployment:ApplyMigrationsOnStartup"))
        await database.Database.MigrateAsync();

    await DatabaseRegistration.InitializeSqliteAsync(database);
    await scope.ServiceProvider.GetRequiredService<IdentityBootstrap>().InitializeAsync();
    await scope.ServiceProvider.GetRequiredService<CatalogSeedService>().InitializeAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

if (!app.Environment.IsDevelopment())
{
    // First in the pipeline so redirects, errors and short-circuited responses also carry the headers.
    app.Use(async (context, next) =>
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
            headers["X-Content-Type-Options"] = "nosniff";
            headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
            headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
            return Task.CompletedTask;
        });
        await next();
    });
}

// Use generic problem responses in every environment; never send exception details to clients.
app.UseExceptionHandler();
app.UseStatusCodePages();
if (app.Configuration["Deployment:TrustForwardedHeaders"] is not null)
    throw new InvalidOperationException(
        "Deployment:TrustForwardedHeaders was removed; configure Deployment:ForwardedHeaders:Enabled, IpRanges and ForwardLimit instead.");
var forwardedConfig = app.Configuration.GetSection("Deployment:ForwardedHeaders");
if (forwardedConfig.GetValue<bool>("Enabled"))
{
    // X-Forwarded-* is honored only when the immediate peer (and each further hop, up to ForwardLimit)
    // is inside the configured CIDR ranges; anything else keeps its real socket address, so spoofed headers are ignored.
    var forwardedHeaders = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
        ForwardLimit = forwardedConfig.GetValue("ForwardLimit", 1)
    };
    if (forwardedHeaders.ForwardLimit is not > 0)
        throw new InvalidOperationException("Deployment:ForwardedHeaders:ForwardLimit must be at least 1.");
    forwardedHeaders.KnownIPNetworks.Clear();
    forwardedHeaders.KnownProxies.Clear();
    foreach (var range in (forwardedConfig["IpRanges"] ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        forwardedHeaders.KnownIPNetworks.Add(System.Net.IPNetwork.TryParse(range, out var network) ? network
            : throw new InvalidOperationException($"Deployment:ForwardedHeaders:IpRanges contains an invalid CIDR range: '{range}'."));
    // Empty known lists would make the middleware trust every peer; fail closed instead.
    if (forwardedHeaders.KnownIPNetworks.Count == 0)
        throw new InvalidOperationException("Deployment:ForwardedHeaders:IpRanges must list at least one trusted proxy CIDR range when Enabled is true.");
    app.UseForwardedHeaders(forwardedHeaders);
}
else
{
    app.Logger.LogInformation("Forwarded headers middleware disabled; client IP is the direct connection peer.");
}
app.UseHttpsRedirection();
app.UseCors("Frontend");
var clientIpSecret = app.Configuration["Deployment:ClientIpProxy:Secret"];
if (!string.IsNullOrWhiteSpace(clientIpSecret))
{
    // The Vercel proxy is the only hop that knows the visitor's IP. It sends it in X-Client-Ip together with this
    // shared secret; without a matching secret the header is ignored, so direct hits on the API cannot spoof an IP.
    const int minSecretLength = 32;
    if (clientIpSecret.Length < minSecretLength)
        throw new InvalidOperationException($"Deployment:ClientIpProxy:Secret must have at least {minSecretLength} characters.");
    app.Logger.LogInformation("Client IP proxy secret configured; X-Client-Ip is honored only with a matching X-Proxy-Secret.");
    var expectedSecret = Encoding.UTF8.GetBytes(clientIpSecret);
    app.Use((context, next) =>
    {
        var providedSecret = Encoding.UTF8.GetBytes(context.Request.Headers["X-Proxy-Secret"].ToString());
        if (CryptographicOperations.FixedTimeEquals(providedSecret, expectedSecret) &&
            IPAddress.TryParse(context.Request.Headers["X-Client-Ip"].ToString(), out var clientIp))
            context.Connection.RemoteIpAddress = clientIp;
        return next();
    });
}
else
{
    app.Logger.LogInformation("Client IP proxy secret not configured; X-Client-Ip is ignored and the rate limit is shared by every visitor behind the proxy.");
}
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<ApiAntiforgeryMiddleware>();
app.MapGet("/health", () => Results.Ok(new { status = "ok" })).AllowAnonymous();
app.MapControllers();

app.Run();

public partial class Program;
