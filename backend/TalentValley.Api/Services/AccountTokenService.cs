using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Email;

namespace TalentValley.Api.Services;

public sealed class AccountTokenService(
    UserManager<ApplicationUser> users, AppDbContext database,
    IOptions<FrontendOptions> frontend, IEmailSender emailSender)
{
    private const string ActivationPurpose = "AccountActivation";

    public Task<string> GenerateActivationTokenAsync(ApplicationUser user) =>
        users.GenerateUserTokenAsync(user, TokenOptions.DefaultProvider, ActivationPurpose);

    public async Task<string> GenerateActivationLinkAsync(ApplicationUser user)
    {
        if (user.EmailConfirmed || await users.HasPasswordAsync(user))
            throw new InvalidOperationException("Account is already activated.");
        return BuildLink("/ativar-conta", user.Email!, await GenerateActivationTokenAsync(user));
    }

    public async Task SendActivationLinkAsync(ApplicationUser user) =>
        await emailSender.SendActivationLinkAsync(user.Email!, await GenerateActivationLinkAsync(user));

    public async Task<bool> ActivateAsync(string email, string token, string password)
    {
        var user = await users.FindByEmailAsync(email.Trim());
        if (user is null || user.EmailConfirmed || await users.HasPasswordAsync(user) ||
            !await users.VerifyUserTokenAsync(user, TokenOptions.DefaultProvider, ActivationPurpose, token)) return false;

        // Password and confirmation must succeed together. Identity concurrency stamps reject competing activation attempts.
        await using var transaction = await database.Database.BeginTransactionAsync();
        if (!(await users.AddPasswordAsync(user, password)).Succeeded) return false;
        user.EmailConfirmed = true;
        if (!(await users.UpdateAsync(user)).Succeeded) return false;
        await transaction.CommitAsync();
        return true;
    }

    public async Task ForgotPasswordAsync(string email)
    {
        var user = await users.FindByEmailAsync(email.Trim());
        if (user is null || !user.EmailConfirmed || !await users.HasPasswordAsync(user)) return;
        var token = await users.GeneratePasswordResetTokenAsync(user);
        try
        {
            await emailSender.SendPasswordResetLinkAsync(user.Email!, BuildLink("/redefinir-senha", user.Email!, token));
        }
        catch (EmailDeliveryUnavailableException)
        {
            // Sender logged an explicit operational failure. Keep the public response identical for every email.
        }
    }

    public async Task<bool> ResetPasswordAsync(string email, string token, string password)
    {
        var user = await users.FindByEmailAsync(email.Trim());
        if (user is null || !user.EmailConfirmed || !await users.HasPasswordAsync(user)) return false;
        return (await users.ResetPasswordAsync(user, token, password)).Succeeded;
    }

    private string BuildLink(string path, string email, string token) =>
        QueryHelpers.AddQueryString(frontend.Value.BaseUrl.TrimEnd('/') + path,
            new Dictionary<string, string?> { ["email"] = email, ["token"] = token });
}
