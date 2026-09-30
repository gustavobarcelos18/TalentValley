using System.Net;

namespace TalentValley.Api.Tests;

public sealed class SecurityHeadersTests
{
    [Fact]
    public async Task Production_responses_include_security_headers()
    {
        using var factory = new ApiFactory { EnvironmentName = "Production" };
        using var client = factory.Client();
        foreach (var path in new[] { "/health", "/api/does-not-exist" })
        {
            var response = await client.GetAsync(path);
            Assert.Equal("max-age=31536000; includeSubDomains", Assert.Single(response.Headers.GetValues("Strict-Transport-Security")));
            Assert.Equal("nosniff", Assert.Single(response.Headers.GetValues("X-Content-Type-Options")));
            Assert.Equal("strict-origin-when-cross-origin", Assert.Single(response.Headers.GetValues("Referrer-Policy")));
            Assert.Contains("default-src 'none'", Assert.Single(response.Headers.GetValues("Content-Security-Policy")));
        }
    }

    [Fact]
    public async Task Development_responses_omit_security_headers()
    {
        using var factory = new ApiFactory();
        using var client = factory.Client();
        var response = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains("Strict-Transport-Security"));
        Assert.False(response.Headers.Contains("X-Content-Type-Options"));
        Assert.False(response.Headers.Contains("Referrer-Policy"));
        Assert.False(response.Headers.Contains("Content-Security-Policy"));
    }
}
