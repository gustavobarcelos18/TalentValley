using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Tests;

public sealed class AccountTokenTests : IDisposable
{
    private readonly ApiFactory factory = new();

    [Fact]
    public async Task Activation_link_sets_first_password_confirms_email_and_cannot_be_reused()
    {
        var id = await factory.CreateUserAsync("maria+activation@example.test", activated: false);
        using var client = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await ApiFactory.LoginAsync(client, "maria+activation@example.test")).StatusCode);
        await factory.InScopeAsync(async provider =>
        {
            var user = (await provider.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(id.ToString()))!;
            await provider.GetRequiredService<AccountTokenService>().SendActivationLinkAsync(user);
        });
        var sent = Assert.Single(factory.Emails.Activations);
        Assert.Equal("maria+activation@example.test", sent.Email);
        var uri = new Uri(sent.Link);
        Assert.Equal("/ativar-conta", uri.AbsolutePath);
        var query = QueryHelpers.ParseQuery(uri.Query);
        Assert.Equal(sent.Email, query["email"].ToString());
        var request = new ActivateAccountRequest(sent.Email, query["token"].ToString(), ApiFactory.Password);
        await ApiFactory.SetCsrfAsync(client);
        var response = await client.PostAsJsonAsync("/api/auth/activate-account", request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.False(response.Headers.Contains("Set-Cookie"));
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/activate-account", request)).StatusCode);
        await factory.InScopeAsync(async provider =>
        {
            var users = provider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = (await users.FindByIdAsync(id.ToString()))!;
            Assert.True(user.EmailConfirmed);
            Assert.True(await users.CheckPasswordAsync(user, ApiFactory.Password));
        });
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, sent.Email)).StatusCode);
    }

    [Theory]
    [InlineData("invalid-token")]
    [InlineData("weak-password")]
    [InlineData("reset-token")]
    [InlineData("unknown-email")]
    public async Task Invalid_activation_does_not_change_account(string fault)
    {
        var id = await factory.CreateUserAsync("maria@example.test", activated: false);
        string token = "invalid";
        await factory.InScopeAsync(async provider =>
        {
            var users = provider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = (await users.FindByIdAsync(id.ToString()))!;
            if (fault == "reset-token") token = await users.GeneratePasswordResetTokenAsync(user);
            else if (fault != "invalid-token") token = await provider.GetRequiredService<AccountTokenService>().GenerateActivationTokenAsync(user);
        });
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        var response = await client.PostAsJsonAsync("/api/auth/activate-account",
            new ActivateAccountRequest(fault == "unknown-email" ? "unknown@example.test" : "maria@example.test", token, fault == "weak-password" ? "weak" : ApiFactory.Password));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.DoesNotContain(token, await response.Content.ReadAsStringAsync());
        await factory.InScopeAsync(async provider =>
        {
            var users = provider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = (await users.FindByIdAsync(id.ToString()))!;
            Assert.False(user.EmailConfirmed);
            Assert.False(await users.HasPasswordAsync(user));
        });
    }

    [Fact]
    public async Task Forgot_password_is_generic_and_reset_link_changes_password_once_without_login()
    {
        await factory.CreateUserAsync("maria@example.test");
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        var known = await client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest("maria@example.test"));
        var unknown = await client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest("unknown@example.test"));
        Assert.Equal(HttpStatusCode.Accepted, known.StatusCode);
        Assert.Equal(known.StatusCode, unknown.StatusCode);
        Assert.Equal(await known.Content.ReadAsStringAsync(), await unknown.Content.ReadAsStringAsync());
        var sent = Assert.Single(factory.Emails.Resets);
        var uri = new Uri(sent.Link);
        Assert.Equal("/redefinir-senha", uri.AbsolutePath);
        var token = QueryHelpers.ParseQuery(uri.Query)["token"].ToString();
        Assert.DoesNotContain(token, await known.Content.ReadAsStringAsync());
        var request = new ResetPasswordRequest(sent.Email, token, "NewPassword123");
        var reset = await client.PostAsJsonAsync("/api/auth/reset-password", request);
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        Assert.False(reset.Headers.Contains("Set-Cookie"));
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/reset-password", request)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await ApiFactory.LoginAsync(client, sent.Email)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, sent.Email, "NewPassword123")).StatusCode);
    }

    [Theory]
    [InlineData("invalid-token")]
    [InlineData("weak-password")]
    [InlineData("activation-token")]
    [InlineData("unknown-email")]
    public async Task Invalid_reset_does_not_change_password(string fault)
    {
        var id = await factory.CreateUserAsync("maria@example.test");
        string token = "invalid";
        await factory.InScopeAsync(async provider =>
        {
            var users = provider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = (await users.FindByIdAsync(id.ToString()))!;
            if (fault == "activation-token") token = await provider.GetRequiredService<AccountTokenService>().GenerateActivationTokenAsync(user);
            else if (fault != "invalid-token") token = await users.GeneratePasswordResetTokenAsync(user);
        });
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        var response = await client.PostAsJsonAsync("/api/auth/reset-password",
            new ResetPasswordRequest(fault == "unknown-email" ? "unknown@example.test" : "maria@example.test", token, fault == "weak-password" ? "weak" : "NewPassword123"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.DoesNotContain(token, await response.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, "maria@example.test")).StatusCode);
    }

    [Fact]
    public async Task Unactivated_account_cannot_bypass_activation_via_password_reset()
    {
        var id = await factory.CreateUserAsync("maria@example.test", activated: false);
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/auth/forgot-password", new ForgotPasswordRequest("maria@example.test"))).StatusCode);
        Assert.Empty(factory.Emails.Resets);
        await factory.InScopeAsync(async provider =>
        {
            var users = provider.GetRequiredService<UserManager<ApplicationUser>>();
            var token = await users.GeneratePasswordResetTokenAsync((await users.FindByIdAsync(id.ToString()))!);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/reset-password", new ResetPasswordRequest("maria@example.test", token, ApiFactory.Password))).StatusCode);
        });
    }

    public void Dispose() => factory.Dispose();
}
