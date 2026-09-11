using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class AuthTests : IDisposable
{
    private readonly ApiFactory factory = new();

    [Theory]
    [InlineData(AppRoles.Student, "/meu-perfil")]
    [InlineData(AppRoles.Recruiter, "/recrutador")]
    [InlineData(AppRoles.Admin, "/admin")]
    public async Task Login_sets_cookie_small_jwt_user_destination_and_timestamps(string role, string destination)
    {
        var id = await factory.CreateUserAsync("maria@example.test", role);
        using var client = factory.Client();
        var response = await ApiFactory.LoginAsync(client, "MARIA@example.test");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.Equal(id, body!.Usuario.Id);
        Assert.Equal(role, body.Usuario.Role);
        Assert.Equal(destination, body.DestinoInicial);
        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), x => x.StartsWith("tv_access="));
        Assert.Contains("httponly", cookie);
        Assert.Contains("samesite=lax", cookie);
        Assert.Contains("path=/", cookie);
        Assert.Contains("expires=", cookie);
        var token = cookie.Split(';')[0]["tv_access=".Length..];
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);
        Assert.Equal(["aud", "exp", "iss", "name", "nbf", "role", "sub"], jwt.Payload.Keys.Order().ToArray());
        Assert.Equal(id.ToString(), jwt.Subject);
        Assert.InRange(jwt.ValidTo - jwt.ValidFrom, TimeSpan.FromHours(8) - TimeSpan.FromSeconds(1), TimeSpan.FromHours(8) + TimeSpan.FromSeconds(1));
        Assert.DoesNotContain(token, await response.Content.ReadAsStringAsync());
        Assert.DoesNotContain("token", await response.Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal(body.Usuario, await client.GetFromJsonAsync<UsuarioAutenticadoResponse>("/api/auth/me"));
        DateTimeOffset? first = null;
        await factory.InScopeAsync(async provider =>
        {
            var user = await provider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(id.ToString());
            Assert.Null(user!.LoginAnteriorEm);
            Assert.NotNull(user.UltimoLoginEm);
            first = user.UltimoLoginEm;
        });
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, "maria@example.test")).StatusCode);
        await factory.InScopeAsync(async provider =>
        {
            var user = await provider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(id.ToString());
            Assert.Equal(first, user!.LoginAnteriorEm);
            Assert.True(user.UltimoLoginEm >= first);
        });
    }

    [Fact]
    public async Task Invalid_password_and_unknown_email_have_identical_generic_failures()
    {
        await factory.CreateUserAsync("maria@example.test");
        using var client = factory.Client();
        var wrong = await ApiFactory.LoginAsync(client, "maria@example.test", "WrongPassword123");
        var unknown = await ApiFactory.LoginAsync(client, "unknown@example.test", "WrongPassword123");
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal(wrong.StatusCode, unknown.StatusCode);
        var a = await wrong.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        var b = await unknown.Content.ReadFromJsonAsync<Microsoft.AspNetCore.Mvc.ProblemDetails>();
        Assert.Equal(a!.Title, b!.Title);
        Assert.Equal("application/problem+json", wrong.Content.Headers.ContentType!.MediaType);
        Assert.False(wrong.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task Five_failed_passwords_lock_account_for_fifteen_minutes()
    {
        var id = await factory.CreateUserAsync("maria@example.test");
        using var client = factory.Client();
        for (var i = 0; i < 4; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await ApiFactory.LoginAsync(client, "maria@example.test", "WrongPassword123")).StatusCode);
        Assert.Equal(HttpStatusCode.Locked, (await ApiFactory.LoginAsync(client, "maria@example.test", "WrongPassword123")).StatusCode);
        Assert.Equal(HttpStatusCode.Locked, (await ApiFactory.LoginAsync(client, "maria@example.test")).StatusCode);
        await factory.InScopeAsync(async provider =>
        {
            var user = await provider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(id.ToString());
            Assert.InRange(user!.LockoutEnd!.Value - DateTimeOffset.UtcNow, TimeSpan.FromMinutes(14), TimeSpan.FromMinutes(15));
        });
    }

    [Fact]
    public async Task Invalid_request_returns_validation_problem()
    {
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = "bad", senha = "" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("errors", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Logout_clears_cookie_and_session()
    {
        await factory.CreateUserAsync("maria@example.test");
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "maria@example.test");
        await ApiFactory.SetCsrfAsync(client);
        var logout = await client.PostAsync("/api/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Contains(logout.Headers.GetValues("Set-Cookie"), x => x.StartsWith("tv_access=;") && x.Contains("expires=Thu, 01 Jan 1970"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Theory]
    [InlineData(AppRoles.Student, "student")]
    [InlineData(AppRoles.Recruiter, "recruiter")]
    public async Task Blocking_in_database_denies_existing_cookie_next_request(string role, string endpoint)
    {
        var id = await factory.CreateUserAsync("maria@example.test", role);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "maria@example.test");
        Assert.Equal(HttpStatusCode.NoContent, (await client.GetAsync($"/api/probe/{endpoint}")).StatusCode);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            if (role == AppRoles.Student) (await db.Alunos.SingleAsync(x => x.UserId == id)).Ativo = false;
            else (await db.Recrutadores.SingleAsync(x => x.UserId == id)).Status = StatusRecrutador.BLOQUEADO;
            await db.SaveChangesAsync();
        });
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"/api/probe/{endpoint}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/probe/fallback")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await ApiFactory.LoginAsync(client, "maria@example.test")).StatusCode);
        await ApiFactory.SetCsrfAsync(client);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync("/api/auth/logout", null)).StatusCode);
    }

    [Theory]
    [InlineData(AppRoles.Student, HttpStatusCode.Forbidden)]
    [InlineData(AppRoles.Recruiter, HttpStatusCode.Forbidden)]
    [InlineData(AppRoles.Admin, HttpStatusCode.NoContent)]
    public async Task Admin_policy_requires_admin(string role, HttpStatusCode expected)
    {
        await factory.CreateUserAsync("maria@example.test", role);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "maria@example.test");
        Assert.Equal(expected, (await client.GetAsync("/api/probe/admin")).StatusCode);
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("expired")]
    [InlineData("issuer")]
    [InlineData("audience")]
    [InlineData("signature")]
    [InlineData("header")]
    public async Task Me_rejects_invalid_or_non_cookie_tokens(string fault)
    {
        var id = await factory.CreateUserAsync("maria@example.test");
        using var client = factory.Client();
        var jwt = new JwtSecurityToken(fault == "issuer" ? "wrong" : "TalentValley.Tests",
            fault == "audience" ? "wrong" : "TalentValley.Tests.Client",
            [new Claim("sub", id.ToString()), new Claim("role", AppRoles.Student), new Claim("name", "Maria")],
            DateTime.UtcNow.AddHours(-2), fault == "expired" ? DateTime.UtcNow.AddMinutes(-1) : DateTime.UtcNow.AddHours(1),
            new SigningCredentials(new SymmetricSecurityKey(fault == "signature" ? System.Security.Cryptography.RandomNumberGenerator.GetBytes(32) : Convert.FromBase64String(factory.SigningKey)), SecurityAlgorithms.HmacSha256));
        var token = new JwtSecurityTokenHandler().WriteToken(jwt);
        if (fault == "header") client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        else if (fault != "missing") client.DefaultRequestHeaders.Add("Cookie", $"tv_access={token}");
        var response = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.DoesNotContain(token, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Removed_role_revokes_existing_access()
    {
        var id = await factory.CreateUserAsync("maria@example.test", AppRoles.Admin);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "maria@example.test");
        await factory.InScopeAsync(async provider =>
        {
            var users = provider.GetRequiredService<UserManager<ApplicationUser>>();
            await users.RemoveFromRoleAsync((await users.FindByIdAsync(id.ToString()))!, AppRoles.Admin);
        });
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/probe/admin")).StatusCode);
    }

    public void Dispose() => factory.Dispose();
}
