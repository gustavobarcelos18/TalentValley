using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.DTOs;
using TalentValley.Api.Email;
using TalentValley.Api.Services;

namespace TalentValley.Api.Tests;

public sealed class FoundationTests
{
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
    public async Task Openapi_and_sqlite_startup_preserve_phase_one()
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
            Assert.Single(await db.Database.GetAppliedMigrationsAsync());
            await db.Database.OpenConnectionAsync();
            await using var command = db.Database.GetDbConnection().CreateCommand();
            command.CommandText = "PRAGMA journal_mode;";
            Assert.Equal("wal", await command.ExecuteScalarAsync());
            command.CommandText = "PRAGMA foreign_keys;";
            Assert.Equal(1L, await command.ExecuteScalarAsync());
            command.CommandText = "PRAGMA synchronous;";
            Assert.Equal(1L, await command.ExecuteScalarAsync());
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
