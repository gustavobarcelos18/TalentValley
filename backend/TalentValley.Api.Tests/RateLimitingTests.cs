using System.Net;
using System.Net.Http.Json;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class RateLimitingTests
{
    private static ApiFactory LimitedFactory() =>
        new() { Overrides = { ["RateLimiting:PermitLimit"] = "5" } };

    [Theory]
    [InlineData("/api/auth/login")]
    [InlineData("/api/auth/forgot-password")]
    [InlineData("/api/auth/resend-activation")]
    [InlineData("/api/cadastro/aluno")]
    [InlineData("/api/cadastro/recrutador")]
    public async Task Sensitive_endpoints_reject_the_sixth_request_within_a_minute(string path)
    {
        using var factory = LimitedFactory();
        using var client = factory.Client();
        // The limiter runs before model binding and antiforgery, so an empty body still counts toward the window.
        for (var i = 0; i < 5; i++)
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync(path, new { })).StatusCode);

        var limited = await client.PostAsJsonAsync(path, new { });
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Equal("60", Assert.Single(limited.Headers.GetValues("Retry-After")));
    }

    [Fact]
    public async Task Limits_are_tracked_per_endpoint_and_do_not_affect_other_routes()
    {
        using var factory = LimitedFactory();
        using var client = factory.Client();
        for (var i = 0; i < 6; i++) await client.PostAsJsonAsync("/api/auth/login", new { });

        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync("/api/auth/login", new { })).StatusCode);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync("/api/cadastro/aluno", new { })).StatusCode);
        for (var i = 0; i < 10; i++) Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/health")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/csrf")).StatusCode);
    }

    [Fact]
    public async Task Change_password_is_limited_too()
    {
        using var factory = LimitedFactory();
        await factory.CreateUserAsync("maria@example.test");
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "maria@example.test");
        await ApiFactory.SetCsrfAsync(client);
        var wrong = new ChangePasswordRequest("WrongPassword123", "NewPassword123");
        for (var i = 0; i < 5; i++)
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync("/api/auth/change-password", wrong)).StatusCode);
        var limited = await client.PostAsJsonAsync("/api/auth/change-password", wrong);
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
        Assert.Equal("60", Assert.Single(limited.Headers.GetValues("Retry-After")));
    }

    [Fact]
    public async Task Successful_login_is_limited_too()
    {
        using var factory = LimitedFactory();
        await factory.CreateUserAsync("maria@example.test");
        using var client = factory.Client();
        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, "maria@example.test")).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await ApiFactory.LoginAsync(client, "maria@example.test")).StatusCode);
    }
}
