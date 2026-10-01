using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace TalentValley.Api.Tests;

public sealed class ForwardedHeadersTests
{
    private const string PeerHeader = "X-Test-Peer";
    private const string RailwayEdge = "10.0.0.5";      // stands in for the platform proxy connecting to the API
    private const string VercelEgress = "203.0.113.7";  // stands in for a trusted upstream proxy

    private static ApiFactory Factory(bool enabled, string ipRanges = "10.0.0.0/8,203.0.113.0/24", int forwardLimit = 2) => new()
    {
        Overrides =
        {
            ["RateLimiting:PermitLimit"] = "5",
            ["Deployment:ForwardedHeaders:Enabled"] = enabled.ToString(),
            ["Deployment:ForwardedHeaders:IpRanges"] = ipRanges,
            ["Deployment:ForwardedHeaders:ForwardLimit"] = forwardLimit.ToString()
        }
    };

    // TestServer has no socket peer; this filter runs before the app pipeline and fakes one per request.
    private static HttpClient Client(ApiFactory factory) => factory.WithWebHostBuilder(builder =>
        builder.ConfigureServices(services => services.AddSingleton<IStartupFilter, FakePeerStartupFilter>()))
        .CreateClient(new() { BaseAddress = new Uri("https://localhost"), AllowAutoRedirect = false });

    private static Task<HttpResponseMessage> PostLogin(HttpClient client, string peer, string forwardedFor)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login") { Content = JsonContent.Create(new { }) };
        request.Headers.Add(PeerHeader, peer);
        request.Headers.Add("X-Forwarded-For", forwardedFor);
        return client.SendAsync(request);
    }

    [Fact]
    public async Task Clients_behind_the_trusted_proxy_chain_get_separate_buckets()
    {
        using var factory = Factory(enabled: true);
        using var client = Client(factory);
        for (var i = 0; i < 5; i++)
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await PostLogin(client, RailwayEdge, $"198.51.100.1, {VercelEgress}")).StatusCode);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await PostLogin(client, RailwayEdge, $"198.51.100.1, {VercelEgress}")).StatusCode);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, (await PostLogin(client, RailwayEdge, $"198.51.100.2, {VercelEgress}")).StatusCode);
    }

    [Theory]
    [InlineData(RailwayEdge, ", 192.0.2.50")] // direct hit on the API domain: the edge appends the attacker's real IP
    [InlineData("192.0.2.99", "")]            // peer outside the trusted ranges
    public async Task Spoofed_forwarded_for_from_untrusted_hops_cannot_rotate_buckets(string peer, string suffix)
    {
        using var factory = Factory(enabled: true);
        using var client = Client(factory);
        for (var i = 0; i < 5; i++)
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await PostLogin(client, peer, $"198.51.100.{i}{suffix}")).StatusCode);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await PostLogin(client, peer, $"198.51.100.99{suffix}")).StatusCode);
    }

    [Fact]
    public async Task Disabled_middleware_ignores_forwarded_for()
    {
        using var factory = Factory(enabled: false);
        using var client = Client(factory);
        for (var i = 0; i < 5; i++)
            Assert.NotEqual(HttpStatusCode.TooManyRequests, (await PostLogin(client, RailwayEdge, $"198.51.100.{i}")).StatusCode);

        Assert.Equal(HttpStatusCode.TooManyRequests, (await PostLogin(client, RailwayEdge, "198.51.100.99")).StatusCode);
    }

    [Theory]
    [InlineData("", "IpRanges")]
    [InlineData("not-a-cidr", "invalid CIDR")]
    public void Enabled_without_valid_ranges_fails_startup(string ipRanges, string expected)
    {
        using var factory = Factory(enabled: true, ipRanges: ipRanges);
        var exception = Assert.ThrowsAny<Exception>(() => factory.Client());
        Assert.Contains(expected, exception.ToString());
    }

    [Fact]
    public void Legacy_trust_flag_fails_startup()
    {
        using var factory = new ApiFactory { Overrides = { ["Deployment:TrustForwardedHeaders"] = "true" } };
        var exception = Assert.ThrowsAny<Exception>(() => factory.Client());
        Assert.Contains("Deployment:TrustForwardedHeaders", exception.ToString());
    }

    private sealed class FakePeerStartupFilter : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((HttpContext context, RequestDelegate nextMiddleware) =>
            {
                if (IPAddress.TryParse(context.Request.Headers[PeerHeader], out var peer))
                    context.Connection.RemoteIpAddress = peer;
                return nextMiddleware(context);
            });
            next(app);
        };
    }
}
