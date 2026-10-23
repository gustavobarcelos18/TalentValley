using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Email;
using TalentValley.Api.Services;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string Password = "TestPassword123"; // Isolated test accounts only.
    private readonly string directory = Path.Combine(Path.GetTempPath(), "TalentValley.Tests", Guid.NewGuid().ToString("N"));
    public string SigningKey { get; } = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
    public string StoragePath => Path.Combine(directory, "storage");
    public string KeysPath => Path.Combine(directory, "dataprotection");
    public RecordingEmailSender Emails { get; } = new();
    public Dictionary<string, string?> Overrides { get; } = new();
    public string EnvironmentName { get; init; } = "Development";
    public bool UseRealEmailSender { get; init; }
    // Tests of the storage provider selection need the real registration instead of the local disk stand-in.
    public bool UseConfiguredFileStorage { get; init; }
    // Outside Development the app requires R2 settings; those tests get fake ones and the local disk instead of the bucket.
    private bool SubstitutesLocalStorage => !UseConfiguredFileStorage && EnvironmentName != Environments.Development;

    private readonly string connectionString;
    private readonly bool ownsDatabase;

    public ApiFactory()
    {
        connectionString = PostgresTestDatabase.CreateDatabase();
        ownsDatabase = true;
        Directory.CreateDirectory(directory);
    }

    // Second application instance on the same database (simulates a restart or another replica); the original factory owns and drops it.
    public ApiFactory(ApiFactory sharedDatabaseWith)
    {
        connectionString = sharedDatabaseWith.connectionString;
        Directory.CreateDirectory(directory);
    }

    private string ConnectionString => connectionString;
    private DbContextOptions<AppDbContext> DatabaseOptions() => PostgresTestDatabase.Options(ConnectionString);

    protected override IHost CreateHost(IHostBuilder builder)
    {
        // DatabaseRegistration reads configuration before the deferred web-host callbacks run.
        builder.ConfigureHostConfiguration(configuration =>
        {
            var settings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = ConnectionString,
                ["DataProtection:KeysPath"] = KeysPath
            };
            if (SubstitutesLocalStorage)
            {
                settings["Storage:Provider"] = StorageOptions.R2Provider;
                settings["Storage:R2:AccountId"] = "testaccount";
                settings["Storage:R2:BucketName"] = "test-bucket";
                settings["Storage:R2:AccessKeyId"] = "test-key-id";
                settings["Storage:R2:SecretAccessKey"] = "test-key-value";
            }
            foreach (var setting in Overrides) settings[setting.Key] = setting.Value;
            configuration.AddInMemoryCollection(settings);
        });
        return base.CreateHost(builder);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment(EnvironmentName);
        builder.ConfigureAppConfiguration((_, configuration) =>
        {
            var settings = new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = ConnectionString,
                ["Jwt:Issuer"] = "TalentValley.Tests", ["Jwt:Audience"] = "TalentValley.Tests.Client",
                ["Jwt:SigningKey"] = SigningKey, ["Jwt:ExpirationHours"] = "8",
                ["Frontend:BaseUrl"] = EnvironmentName == "Development" ? "http://localhost:3000" : "https://talent.example",
                ["AllowedHosts"] = "localhost;talent.example", // "localhost" keeps the test client's host accepted.
                ["BootstrapAdmin:Email"] = "", ["BootstrapAdmin:Password"] = "", ["BootstrapAdmin:Name"] = "",
                ["Storage:RootPath"] = StoragePath,
                ["RateLimiting:PermitLimit"] = "1000", // Effectively off; rate-limit tests override it.
                ["Logging:LogLevel:Default"] = "Error"
            };
            foreach (var setting in Overrides) settings[setting.Key] = setting.Value;
            configuration.AddInMemoryCollection(settings);
        });
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.AddScoped(_ => DatabaseOptions());
            services.AddControllers().AddApplicationPart(typeof(PolicyProbeController).Assembly);
            if (SubstitutesLocalStorage)
            {
                services.RemoveAll<IFileStorage>();
                services.AddSingleton<IFileStorage, LocalFileStorage>();
            }
            if (!UseRealEmailSender)
            {
                services.RemoveAll<IEmailSender>();
                services.AddSingleton<IEmailSender>(Emails);
            }
        });
    }

    public HttpClient Client() => CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false, HandleCookies = true
    });

    public static async Task SetCsrfAsync(HttpClient client)
    {
        var response = await client.GetAsync("/api/auth/csrf");
        response.EnsureSuccessStatusCode();
        var csrf = await response.Content.ReadFromJsonAsync<CsrfResponse>();
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-XSRF-TOKEN", csrf!.Token);
    }

    public static async Task<HttpResponseMessage> LoginAsync(HttpClient client, string email, string password = Password)
    {
        await SetCsrfAsync(client);
        return await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(email, password));
    }

    // Accounts accept the current terms by default, so tests of other features are not blocked by the terms gate;
    // pass termsVersion: null (or an old version) to create an account with the terms pending.
    public async Task<Guid> CreateUserAsync(string email, string role = AppRoles.Student, bool active = true, bool activated = true,
        string? termsVersion = SolicitacaoCadastroService.VersaoTermosAtual)
    {
        using var scope = Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, EmailConfirmed = activated,
            NomeCompleto = "Maria Álvares", NomeBusca = "maria alvares", CriadoEm = DateTimeOffset.UtcNow
        };
        Assert.True((activated ? await users.CreateAsync(user, Password) : await users.CreateAsync(user)).Succeeded);
        Assert.True((await users.AddToRoleAsync(user, role)).Succeeded);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (role == AppRoles.Student)
            db.Alunos.Add(new Aluno
            {
                UserId = user.Id, Slug = user.Id.ToString(), Ativo = active, AtualizadoEm = DateTimeOffset.UtcNow,
                VersaoTermos = termsVersion, ConsentimentoEm = termsVersion is null ? null : DateTimeOffset.UtcNow
            });
        if (role == AppRoles.Recruiter)
            db.Recrutadores.Add(new Recrutador
            {
                UserId = user.Id, Status = active ? StatusRecrutador.ATIVO : StatusRecrutador.BLOQUEADO,
                VersaoTermos = termsVersion, ConsentimentoEm = termsVersion is null ? null : DateTimeOffset.UtcNow
            });
        await db.SaveChangesAsync();
        return user.Id;
    }

    public async Task InScopeAsync(Func<IServiceProvider, Task> action)
    {
        using var scope = Services.CreateScope();
        await action(scope.ServiceProvider);
    }
    // Mirrors the API JSON options: enums are always strings, never integers.
    public static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(allowIntegerValues: false) }
    };

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (!disposing) return;
        if (ownsDatabase) PostgresTestDatabase.DropDatabase(connectionString);
        if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true);
    }
}

public sealed class RecordingEmailSender : IEmailSender
{
    public Func<string, string, Task>? ActivationDelivery { get; set; }
    public List<(string Email, string Link)> Activations { get; } = [];
    public List<(string Email, string Link)> Resets { get; } = [];
    public async Task SendActivationLinkAsync(string email, string link)
    {
        if (ActivationDelivery is not null) await ActivationDelivery(email, link);
        lock (Activations) Activations.Add((email, link));
    }
    public Task SendPasswordResetLinkAsync(string email, string link) { Resets.Add((email, link)); return Task.CompletedTask; }
}
