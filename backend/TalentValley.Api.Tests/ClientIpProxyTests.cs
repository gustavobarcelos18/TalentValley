using System.Net;
using System.Net.Http.Json;

namespace TalentValley.Api.Tests;

public sealed class ClientIpProxyTests
{
    private const string Secret = "0123456789abcdef0123456789abcdef";

    private static ApiFactory Factory(string secret = Secret) => new()
    {
        Overrides =
        {
            ["RateLimiting:PermitLimit"] = "5",
            ["Deployment:ClientIpProxy:Secret"] = secret
        }
    };

    private static HttpClient Client(ApiFactory factory) =>
        factory.CreateClient(new() { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });

    private static Task<HttpResponseMessage> PostLogin(HttpClient client, string? clientIp, string? secret)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login") { Content = JsonContent.Create(new { }) };
        if (clientIp is not null) request.Headers.Add("X-Client-Ip", clientIp);
        if (secret is not null) request.Headers.Add("X-Proxy-Secret", secret);
        return client.SendAsync(request);
    }

    [Fact]
    public async Task Visitors_with_the_shared_secret_get_separate_buckets()
    {
        using var factory = Factory();
        using var client = Client(factory);
        for (var i = 0; i < 5; i++)
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await PostLogin(client, "198.51.100.1", Secret)).StatusCode);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await PostLogin(client, "198.51.100.1", Secret)).StatusCode);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await PostLogin(client, "198.51.100.2", Secret)).StatusCode);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await PostLogin(client, "2001:db8::1", Secret)).StatusCode);
    }

    [Theory]
    [InlineData("wrong-secret-wrong-secret-wrong-secret")]
    [InlineData("")]
    [InlineData(null)]
    public async Task Client_ip_without_the_matching_secret_cannot_rotate_buckets(string? secret)
    {
        using var factory = Factory();
        using var client = Client(factory);
        for (var i = 0; i < 5; i++)
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await PostLogin(client, $"198.51.100.{i}", secret)).StatusCode);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await PostLogin(client, "198.51.100.99", secret)).StatusCode);
    }

    [Theory]
    [InlineData("not-an-ip")]
    [InlineData("198.51.100.1, 198.51.100.2")]
    [InlineData("")]
    [InlineData(null)]
    public async Task Missing_or_invalid_client_ip_keeps_the_connection_address(string? clientIp)
    {
        using var factory = Factory();
        using var client = Client(factory);
        for (var i = 0; i < 5; i++)
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await PostLogin(client, clientIp, Secret)).StatusCode);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await PostLogin(client, clientIp, Secret)).StatusCode);
    }

    [Fact]
    public async Task Without_a_configured_secret_the_headers_are_ignored()
    {
        using var factory = Factory(secret: "");
        using var client = Client(factory);
        for (var i = 0; i < 5; i++)
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await PostLogin(client, $"198.51.100.{i}", Secret)).StatusCode);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await PostLogin(client, "198.51.100.99", Secret)).StatusCode);
    }

    [Fact]
    public void A_secret_shorter_than_32_characters_fails_startup()
    {
        using var factory = Factory(secret: "too-short");
        var exception = Assert.ThrowsAny<Exception>(() => factory.Client());
        Assert.Contains("Deployment:ClientIpProxy:Secret", exception.ToString());
    }
}
