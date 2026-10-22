using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.DTOs;
using TalentValley.Api.Email;
using TalentValley.Api.Services;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Tests;

public sealed class FoundationTests
{
    private const string KeysPathSetting = "DataProtection:KeysPath";
    private const string HealthPath = "/health";

    [Fact]
    public async Task Roles_and_optional_admin_bootstrap_are_idempotent()
    {
        using var factory = new ApiFactory();
        factory.Overrides["BootstrapAdmin:Email"] = "admin@example.test";
        factory.Overrides["BootstrapAdmin:Password"] = ApiFactory.Password;
        factory.Overrides["BootstrapAdmin:Name"] = "  José   Álvares  ";
        using var client = factory.Client();
        await factory.InScopeAsync(async provider =>
        {
            await provider.GetRequiredService<IdentityBootstrap>().InitializeAsync();
            await provider.GetRequiredService<IdentityBootstrap>().InitializeAsync();
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.Equal(AppRoles.All.Order(), await db.Roles.Select(x => x.Name!).OrderBy(x => x).ToArrayAsync());
            var admin = Assert.Single(await db.Users.ToListAsync());
            Assert.Equal("jose alvares", admin.NomeBusca);
            Assert.True(await provider.GetRequiredService<UserManager<ApplicationUser>>().IsInRoleAsync(admin, AppRoles.Admin));
        });
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, "admin@example.test")).StatusCode);
    }

    [Fact]
    public async Task Missing_admin_configuration_starts_without_creating_users()
    {
        using var factory = new ApiFactory();
        using var client = factory.Client();
        await factory.InScopeAsync(async provider => Assert.Empty(await provider.GetRequiredService<AppDbContext>().Users.ToListAsync()));
    }

    [Fact]
    public async Task Production_ignores_admin_bootstrap_and_sets_secure_cookies()
    {
        using var factory = new ApiFactory { EnvironmentName = "Production" };
        factory.Overrides["BootstrapAdmin:Email"] = "bootstrap@example.test";
        factory.Overrides["BootstrapAdmin:Password"] = ApiFactory.Password;
        factory.Overrides["BootstrapAdmin:Name"] = "Admin";
        using var client = factory.Client();
        await factory.InScopeAsync(async provider => Assert.Empty(await provider.GetRequiredService<AppDbContext>().Users.ToListAsync()));
        await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        var response = await ApiFactory.LoginAsync(client, "admin@example.test");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("secure", Assert.Single(response.Headers.GetValues("Set-Cookie"), x => x.StartsWith("tv_access=")));
        var csrf = await client.GetAsync("/api/auth/csrf");
        Assert.Equal(HttpStatusCode.OK, csrf.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/openapi/v1.json")).StatusCode);
    }

    [Fact]
    public async Task Production_bootstraps_admin_when_explicitly_enabled_and_remains_idempotent()
    {
        using var enabledFactory = new ApiFactory { EnvironmentName = "Production" };
        enabledFactory.Overrides["BootstrapAdmin:Enabled"] = "true";
        enabledFactory.Overrides["BootstrapAdmin:Email"] = "bootstrap@example.test";
        enabledFactory.Overrides["BootstrapAdmin:Password"] = ApiFactory.Password;
        enabledFactory.Overrides["BootstrapAdmin:Name"] = "Admin";
        using var enabledClient = enabledFactory.Client();
        await enabledFactory.InScopeAsync(async provider =>
        {
            var bootstrap = provider.GetRequiredService<IdentityBootstrap>();
            await bootstrap.InitializeAsync();
            await bootstrap.InitializeAsync();
            Assert.Single(await provider.GetRequiredService<AppDbContext>().Users.ToListAsync());
        });
    }

    [Fact]
    public async Task Bootstrap_never_promotes_an_existing_non_admin_account()
    {
        using var factory = new ApiFactory { EnvironmentName = "Production" };
        using var client = factory.Client();
        await factory.CreateUserAsync("student@example.test");
        await factory.InScopeAsync(provider =>
        {
            var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BootstrapAdmin:Enabled"] = "true",
                ["BootstrapAdmin:Email"] = "student@example.test",
                ["BootstrapAdmin:Password"] = ApiFactory.Password,
                ["BootstrapAdmin:Name"] = "Admin"
            }).Build();
            var bootstrap = new IdentityBootstrap(
                provider.GetRequiredService<RoleManager<IdentityRole<Guid>>>(),
                provider.GetRequiredService<UserManager<ApplicationUser>>(),
                provider.GetRequiredService<AppDbContext>(),
                configuration,
                provider.GetRequiredService<Microsoft.Extensions.Hosting.IHostEnvironment>(),
                provider.GetRequiredService<ILogger<IdentityBootstrap>>());
            return Assert.ThrowsAsync<InvalidOperationException>(() => bootstrap.InitializeAsync());
        });
    }

    [Fact]
    public async Task Health_is_anonymous_and_returns_ok()
    {
        using var factory = new ApiFactory { EnvironmentName = "Production" };
        using var client = factory.Client();
        var response = await client.GetAsync(HealthPath);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("{\"status\":\"ok\"}", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("Development", "")]
    [InlineData("Production", "")]
    [InlineData("Production", "short")]
    [InlineData("Production", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")]
    public void Missing_or_unsafe_jwt_key_fails_startup_clearly(string environment, string key)
    {
        using var factory = new ApiFactory { EnvironmentName = environment };
        factory.Overrides["Jwt:SigningKey"] = key;
        var exception = Assert.ThrowsAny<Exception>(() => factory.Client());
        Assert.Contains("Jwt:SigningKey", exception.ToString());
    }

    [Theory]
    [InlineData("Production", "")]
    [InlineData("Production", "*")]
    [InlineData("Production", "localhost")]
    [InlineData("Production", "LocalHost;*")]
    public void Missing_or_unsafe_allowed_hosts_fails_startup_outside_development(string environment, string hosts)
    {
        using var factory = new ApiFactory { EnvironmentName = environment };
        factory.Overrides["AllowedHosts"] = hosts;
        var exception = Assert.ThrowsAny<Exception>(() => factory.Client());
        Assert.Contains("AllowedHosts", exception.ToString());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Local")]
    public void Production_without_r2_storage_fails_startup_clearly(string? provider)
    {
        using var factory = new ApiFactory { EnvironmentName = "Production", UseConfiguredFileStorage = true };
        factory.Overrides["Storage:Provider"] = provider;
        var exception = Assert.ThrowsAny<Exception>(() => factory.Client());
        Assert.Contains("Storage:Provider", exception.ToString());
    }

    [Theory]
    [InlineData("S3")]
    [InlineData("r3")]
    public void Unknown_storage_provider_fails_startup_clearly(string provider)
    {
        using var factory = new ApiFactory { EnvironmentName = "Development", UseConfiguredFileStorage = true };
        factory.Overrides["Storage:Provider"] = provider;
        var exception = Assert.ThrowsAny<Exception>(() => factory.Client());
        Assert.Contains("Storage:Provider", exception.ToString());
    }

    [Theory]
    [InlineData("AccountId")]
    [InlineData("BucketName")]
    [InlineData("AccessKeyId")]
    [InlineData("SecretAccessKey")]
    public void Production_with_incomplete_r2_settings_fails_startup_without_leaking_values(string missing)
    {
        using var factory = new ApiFactory { EnvironmentName = "Production", UseConfiguredFileStorage = true };
        ConfigureR2(factory);
        factory.Overrides[$"Storage:R2:{missing}"] = "";
        var exception = Assert.ThrowsAny<Exception>(() => factory.Client());
        Assert.Contains($"Storage:R2:{missing}", exception.ToString());
        Assert.DoesNotContain("r2-secret-value", exception.ToString());
    }

    [Fact]
    public void Production_with_r2_settings_starts_and_uses_the_r2_storage()
    {
        using var factory = new ApiFactory { EnvironmentName = "Production", UseConfiguredFileStorage = true };
        ConfigureR2(factory);
        using var client = factory.Client();
        using var scope = factory.Services.CreateScope();
        Assert.IsType<R2FileStorage>(scope.ServiceProvider.GetRequiredService<IFileStorage>());
    }

    [Fact]
    public void Development_without_a_storage_provider_uses_the_local_disk()
    {
        using var factory = new ApiFactory { EnvironmentName = "Development", UseConfiguredFileStorage = true };
        using var client = factory.Client();
        using var scope = factory.Services.CreateScope();
        Assert.IsType<LocalFileStorage>(scope.ServiceProvider.GetRequiredService<IFileStorage>());
    }

    private static void ConfigureR2(ApiFactory factory)
    {
        factory.Overrides["Storage:Provider"] = StorageOptions.R2Provider;
        factory.Overrides["Storage:R2:AccountId"] = "testaccount";
        factory.Overrides["Storage:R2:BucketName"] = "test-bucket";
        factory.Overrides["Storage:R2:AccessKeyId"] = "r2-key-id";
        factory.Overrides["Storage:R2:SecretAccessKey"] = "r2-secret-value";
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Production_without_data_protection_keys_path_starts_and_stores_the_keys_in_the_database(string keysPath)
    {
        using var factory = new ApiFactory { EnvironmentName = "Production" };
        factory.Overrides[KeysPathSetting] = keysPath;
        using var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(HealthPath)).StatusCode);
        var id = await factory.CreateUserAsync("maria@example.test", activated: false);
        await factory.InScopeAsync(async provider =>
        {
            var user = (await provider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(id.ToString()))!;
            Assert.NotEmpty(await provider.GetRequiredService<AccountTokenService>().GenerateActivationTokenAsync(user));
            Assert.Single(await provider.GetRequiredService<AppDbContext>().DataProtectionKeys.ToListAsync());
        });
        Assert.False(Directory.Exists(factory.KeysPath));
    }

    [Fact]
    public async Task Activation_token_stays_valid_on_a_new_instance_sharing_the_database()
    {
        using var first = new ApiFactory { EnvironmentName = "Production" };
        first.Overrides[KeysPathSetting] = "";
        var id = await first.CreateUserAsync("maria@example.test", activated: false);
        var token = "";
        await first.InScopeAsync(async provider =>
        {
            var user = (await provider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(id.ToString()))!;
            token = await provider.GetRequiredService<AccountTokenService>().GenerateActivationTokenAsync(user);
        });

        // Declared after "first", so it is disposed first and "first" can drop the shared database.
        using var second = new ApiFactory(first) { EnvironmentName = "Production" };
        second.Overrides[KeysPathSetting] = "";
        var activated = false;
        await second.InScopeAsync(async provider =>
        {
            activated = await provider.GetRequiredService<AccountTokenService>()
                .ActivateAsync("maria@example.test", token, ApiFactory.Password);
            Assert.Single(await provider.GetRequiredService<AppDbContext>().DataProtectionKeys.ToListAsync());
        });
        Assert.True(activated);
    }

    [Fact]
    public async Task Production_accepts_a_configured_data_protection_keys_path()
    {
        using var factory = new ApiFactory { EnvironmentName = "Production" };
        using var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(HealthPath)).StatusCode);
        Assert.True(Directory.Exists(factory.KeysPath));
    }

    [Fact]
    public async Task Development_starts_without_data_protection_keys_path()
    {
        using var factory = new ApiFactory { EnvironmentName = "Development" };
        factory.Overrides[KeysPathSetting] = "";
        using var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(HealthPath)).StatusCode);
    }

    [Fact]
    public void Development_accepts_localhost_allowed_hosts()
    {
        using var factory = new ApiFactory { EnvironmentName = "Development" };
        factory.Overrides["AllowedHosts"] = "localhost";
        using var client = factory.Client();
    }

    [Theory]
    [InlineData("abc")]
    [InlineData("Abcdefgh")]
    [InlineData("abcdefgh1")]
    [InlineData("ABCDEFGH1")]
    public async Task Identity_enforces_password_policy(string password)
    {
        using var factory = new ApiFactory();
        await factory.InScopeAsync(async provider =>
        {
            var users = provider.GetRequiredService<UserManager<ApplicationUser>>();
            var result = await users.CreateAsync(new ApplicationUser { UserName = "test@example.test", Email = "test@example.test" }, password);
            Assert.False(result.Succeeded);
        });
    }

    [Fact]
    public async Task Identity_requires_unique_normalized_email()
    {
        using var factory = new ApiFactory();
        await factory.CreateUserAsync("maria@example.test");
        await factory.InScopeAsync(async provider =>
        {
            var result = await provider.GetRequiredService<UserManager<ApplicationUser>>().CreateAsync(
                new ApplicationUser { UserName = "different", Email = "MARIA@example.test" }, ApiFactory.Password);
            Assert.Contains(result.Errors, x => x.Code == "DuplicateEmail");
        });
    }

    [Theory]
    [InlineData("http://localhost:3000", true)]
    [InlineData("https://untrusted.example", false)]
    public async Task Cors_only_allows_configured_frontend(string origin, bool allowed)
    {
        using var factory = new ApiFactory();
        using var client = factory.Client();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/auth/login");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "POST");
        request.Headers.Add("Access-Control-Request-Headers", "Content-Type,X-XSRF-TOKEN");
        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
        if (allowed)
        {
            Assert.Equal(origin, Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
            Assert.Equal("true", Assert.Single(response.Headers.GetValues("Access-Control-Allow-Credentials")));
        }
    }

    [Fact]
    public async Task Openapi_and_database_startup_preserve_phase_one()
    {
        using var factory = new ApiFactory();
        using var client = factory.Client();
        var response = await client.GetAsync("/openapi/v1.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("/api/auth/login", await response.Content.ReadAsStringAsync());
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.False(db.Database.HasPendingModelChanges());
            var migrations = (await db.Database.GetAppliedMigrationsAsync()).ToList();
            Assert.Equal(7, migrations.Count);
            Assert.EndsWith("_InitialCreate", migrations[0]);
            Assert.EndsWith("_AddDataProtectionKeys", migrations[1]);
            Assert.EndsWith("_AddUserDemoFlag", migrations[2]);
            Assert.EndsWith("_AddCompetenciaCategoria", migrations[3]);
            Assert.EndsWith("_AddRecrutadorConsentAndNewsletter", migrations[4]);
            Assert.EndsWith("_RemoveNamesFromErasedPersonAudit", migrations[5]);
            Assert.EndsWith("_AddLattesUrl", migrations[6]);
            Assert.True(db.Database.IsNpgsql());
        });
    }

    [Fact]
    public async Task Email_senders_log_development_links_and_fail_explicitly_outside_development()
    {
        var developmentLog = new RecordingLogger<DevelopmentEmailSender>();
        var development = new DevelopmentEmailSender(developmentLog);
        await development.SendActivationLinkAsync("maria@example.test", "http://localhost:3000/ativar-conta?token=test");
        await development.SendPasswordResetLinkAsync("maria@example.test", "http://localhost:3000/redefinir-senha?token=test");
        Assert.Equal(2, developmentLog.Messages.Count);
        Assert.All(developmentLog.Messages, x => Assert.Contains("maria@example.test", x));
        Assert.Contains(developmentLog.Messages, x => x.Contains("/ativar-conta?token=test"));
        Assert.Contains(developmentLog.Messages, x => x.Contains("/redefinir-senha?token=test"));
        var productionLog = new RecordingLogger<UnavailableEmailSender>();
        var production = new UnavailableEmailSender(productionLog);
        await Assert.ThrowsAsync<EmailDeliveryUnavailableException>(() => production.SendActivationLinkAsync("email", "link"));
        await Assert.ThrowsAsync<EmailDeliveryUnavailableException>(() => production.SendPasswordResetLinkAsync("email", "link"));
        Assert.Equal(2, productionLog.Messages.Count);
    }

    [Fact]
    public void Production_email_sender_requires_complete_brevo_configuration()
    {
        using var disabledFactory = new ApiFactory { EnvironmentName = "Production", UseRealEmailSender = true };
        using var disabledClient = disabledFactory.Client();
        Assert.IsType<UnavailableEmailSender>(disabledFactory.Services.GetRequiredService<IEmailSender>());

        using var incompleteFactory = new ApiFactory { EnvironmentName = "Production", UseRealEmailSender = true };
        incompleteFactory.Overrides["Brevo:ApiKey"] = "test-key";
        using var incompleteClient = incompleteFactory.Client();
        Assert.IsType<UnavailableEmailSender>(incompleteFactory.Services.GetRequiredService<IEmailSender>());

        using var missingNameFactory = new ApiFactory { EnvironmentName = "Production", UseRealEmailSender = true };
        missingNameFactory.Overrides["Brevo:ApiKey"] = "test-key";
        missingNameFactory.Overrides["Brevo:SenderAddress"] = "no-reply@example.test";
        using var missingNameClient = missingNameFactory.Client();
        Assert.IsType<UnavailableEmailSender>(missingNameFactory.Services.GetRequiredService<IEmailSender>());

        using var whitespaceKeyFactory = new ApiFactory { EnvironmentName = "Production", UseRealEmailSender = true };
        whitespaceKeyFactory.Overrides["Brevo:ApiKey"] = "  ";
        whitespaceKeyFactory.Overrides["Brevo:SenderAddress"] = "no-reply@example.test";
        whitespaceKeyFactory.Overrides["Brevo:SenderName"] = "Talent Valley";
        using var whitespaceKeyClient = whitespaceKeyFactory.Client();
        Assert.IsType<UnavailableEmailSender>(whitespaceKeyFactory.Services.GetRequiredService<IEmailSender>());

        using var enabledFactory = new ApiFactory { EnvironmentName = "Production", UseRealEmailSender = true };
        enabledFactory.Overrides["Brevo:ApiKey"] = "test-key";
        enabledFactory.Overrides["Brevo:SenderAddress"] = "no-reply@example.test";
        enabledFactory.Overrides["Brevo:SenderName"] = "Talent Valley";
        using var enabledClient = enabledFactory.Client();
        Assert.IsType<BrevoEmailSender>(enabledFactory.Services.GetRequiredService<IEmailSender>());

        using var developmentFactory = new ApiFactory { UseRealEmailSender = true };
        developmentFactory.Overrides["Brevo:ApiKey"] = "test-key";
        developmentFactory.Overrides["Brevo:SenderAddress"] = "no-reply@example.test";
        developmentFactory.Overrides["Brevo:SenderName"] = "Talent Valley";
        using var developmentClient = developmentFactory.Client();
        Assert.IsType<DevelopmentEmailSender>(developmentFactory.Services.GetRequiredService<IEmailSender>());
    }

    [Fact]
    public async Task Missing_production_sender_keeps_forgot_response_identical()
    {
        using var factory = new ApiFactory { EnvironmentName = "Production", UseRealEmailSender = true };
        await factory.CreateUserAsync("maria@example.test");
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        var known = await client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest("maria@example.test"));
        var unknown = await client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest("unknown@example.test"));
        Assert.Equal(HttpStatusCode.Accepted, known.StatusCode);
        Assert.Equal(known.StatusCode, unknown.StatusCode);
        Assert.Equal(await known.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("  JOÃO\t da  Conceição  ", "joao da conceicao")]
    [InlineData("Érica\nÁLVARES", "erica alvares")]
    public void Name_normalization_removes_diacritics_and_collapses_whitespace(string name, string expected) =>
        Assert.Equal(expected, NameNormalizer.Normalize(name));
}

public sealed class RecordingLogger<T> : ILogger<T>
{
    public List<string> Messages { get; } = [];
    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
    public bool IsEnabled(LogLevel logLevel) => true;
    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter) =>
        Messages.Add(formatter(state, exception));
}
