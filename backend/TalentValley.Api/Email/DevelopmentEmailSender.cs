namespace TalentValley.Api.Email;

public sealed class DevelopmentEmailSender(ILogger<DevelopmentEmailSender> logger, bool isDemoMode = false) : IEmailSender
{
    public Task SendActivationLinkAsync(string email, string link)
    {
        LogLink("account activation", email, link);
        return Task.CompletedTask;
    }

    public Task SendPasswordResetLinkAsync(string email, string link)
    {
        LogLink("password reset", email, link);
        return Task.CompletedTask;
    }

    private void LogLink(string kind, string email, string link)
    {
        if (isDemoMode)
            logger.LogWarning("DEMO-ONLY email to {Email}: {Kind} link {Link}", email, kind, link);
        else
            logger.LogInformation("Development email to {Email}: {Kind} link {Link}", email, kind, link);
    }
}
