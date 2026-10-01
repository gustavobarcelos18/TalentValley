using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.IdentityModel.Tokens;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class SecurityStampTests : IDisposable
{
    private readonly ApiFactory factory = new();

    [Fact]
    public async Task Password_reset_invalidates_previously_issued_jwt()
    {
        await factory.CreateUserAsync("maria@example.test");
        using var client = factory.Client();
        var login = await ApiFactory.LoginAsync(client, "maria@example.test");
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var oldToken = AccessToken(login);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);

        await ApiFactory.SetCsrfAsync(client);
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/auth/forgot-password",
            new ForgotPasswordRequest("maria@example.test"))).StatusCode);
        var token = QueryHelpers.ParseQuery(new Uri(Assert.Single(factory.Emails.Resets).Link).Query)["token"].ToString();
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/auth/reset-password",
            new ResetPasswordRequest("maria@example.test", token, "NewPassword123"))).StatusCode);

        // The client still holds the pre-reset cookie: it must no longer authenticate.
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        using (var replay = factory.Client())
        {
            replay.DefaultRequestHeaders.Add("Cookie", $"tv_access={oldToken}");
            Assert.Equal(HttpStatusCode.Unauthorized, (await replay.GetAsync("/api/auth/me")).StatusCode);
        }

        var relogin = await ApiFactory.LoginAsync(client, "maria@example.test", "NewPassword123");
        Assert.Equal(HttpStatusCode.OK, relogin.StatusCode);
        Assert.NotEqual(oldToken, AccessToken(relogin));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("forged")]
    public async Task Signed_token_without_matching_security_stamp_is_rejected(string? stamp)
    {
        var id = await factory.CreateUserAsync("maria@example.test");
        List<Claim> claims = [new("sub", id.ToString()), new("role", AppRoles.Student), new("name", "Maria")];
        if (stamp is not null) claims.Add(new(JwtTokenService.SecurityStampClaim, JwtTokenService.HashSecurityStamp(stamp)));
        var jwt = new JwtSecurityToken("TalentValley.Tests", "TalentValley.Tests.Client", claims,
            DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddHours(1),
            new SigningCredentials(new SymmetricSecurityKey(Convert.FromBase64String(factory.SigningKey)), SecurityAlgorithms.HmacSha256));
        using var client = factory.Client();
        client.DefaultRequestHeaders.Add("Cookie", $"tv_access={new JwtSecurityTokenHandler().WriteToken(jwt)}");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    private static string AccessToken(HttpResponseMessage login) =>
        Assert.Single(login.Headers.GetValues("Set-Cookie"), x => x.StartsWith("tv_access="))
            .Split(';')[0]["tv_access=".Length..];

    public void Dispose() => factory.Dispose();
}
