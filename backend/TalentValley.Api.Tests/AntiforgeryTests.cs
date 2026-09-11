using System.Net;
using System.Net.Http.Json;

namespace TalentValley.Api.Tests;

public sealed class AntiforgeryTests : IDisposable
{
    private readonly ApiFactory factory = new();

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    [InlineData("PATCH")]
    [InlineData("DELETE")]
    public async Task Authenticated_mutations_require_valid_antiforgery(string method)
    {
        await factory.CreateUserAsync("maria@example.test");
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "maria@example.test");
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), "/api/probe/change"))).StatusCode);
        client.DefaultRequestHeaders.Add("X-XSRF-TOKEN", "invalid");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), "/api/probe/change"))).StatusCode);
        await ApiFactory.SetCsrfAsync(client);
        Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), "/api/probe/change"))).StatusCode);
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Theory]
    [InlineData("login")]
    [InlineData("logout")]
    [InlineData("activate-account")]
    [InlineData("forgot-password")]
    [InlineData("reset-password")]
    public async Task Anonymous_auth_mutations_require_antiforgery(string endpoint)
    {
        using var client = factory.Client();
        var response = await client.PostAsJsonAsync($"/api/auth/{endpoint}", new { });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Invalid antiforgery token", await response.Content.ReadAsStringAsync());
        await ApiFactory.SetCsrfAsync(client);
        response = await client.PostAsJsonAsync($"/api/auth/{endpoint}", new { });
        Assert.DoesNotContain("Invalid antiforgery token", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Anonymous_token_must_be_refreshed_after_login()
    {
        await factory.CreateUserAsync("maria@example.test");
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "maria@example.test");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsync("/api/auth/logout", null)).StatusCode);
        await ApiFactory.SetCsrfAsync(client);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/auth/logout", null)).StatusCode);
    }

    [Fact]
    public async Task Token_from_another_browser_is_rejected()
    {
        using var client = factory.Client();
        using var other = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        other.DefaultRequestHeaders.Add("X-XSRF-TOKEN", client.DefaultRequestHeaders.GetValues("X-XSRF-TOKEN"));
        Assert.Equal(HttpStatusCode.BadRequest, (await other.PostAsync("/api/auth/logout", null)).StatusCode);
    }

    public void Dispose() => factory.Dispose();
}
