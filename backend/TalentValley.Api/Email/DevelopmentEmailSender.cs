namespace TalentValley.Api.Email;

public sealed class DevelopmentEmailSender(ILogger<DevelopmentEmailSender> logger) : IEmailSender
{
    public Task SendActivationLinkAsync(string email, string link)
    {
        logger.LogInformation("Development email to {Email}: account activation link {Link}", email, link);
        return Task.CompletedTask;
    }

    public Task SendPasswordResetLinkAsync(string email, string link)
    {
        logger.LogInformation("Development email to {Email}: password reset link {Link}", email, link);
        return Task.CompletedTask;
    }
}
