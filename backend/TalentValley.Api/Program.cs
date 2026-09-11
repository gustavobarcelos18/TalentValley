using System.Text.Json.Serialization;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter(allowIntegerValues: false)));
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuditoriaService>();
builder.Services.AddScoped<AdminAccountService>();
builder.Services.AddScoped<AdminAlunoService>();
builder.Services.AddScoped<AdminRecrutadorService>();
builder.Services.AddScoped<SlugService>();
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
    context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier);
builder.Services.AddOpenApi();
builder.Services.AddApplicationDatabase(builder.Configuration, builder.Environment);
builder.Services.AddApplicationSecurity(builder.Configuration, builder.Environment);

var app = builder.Build();

await using (var scope = app.Services.CreateAsyncScope())
{
    // Schema changes are applied explicitly with dotnet ef, never during startup.
    await DatabaseRegistration.InitializeSqliteAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    await scope.ServiceProvider.GetRequiredService<IdentityBootstrap>().InitializeAsync();
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
}

// Use generic problem responses in every environment; never send exception details to clients.
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseHttpsRedirection();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<ApiAntiforgeryMiddleware>();
app.MapControllers();

app.Run();

public partial class Program;
