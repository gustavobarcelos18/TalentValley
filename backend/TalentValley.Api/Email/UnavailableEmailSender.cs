namespace TalentValley.Api.Email;

public sealed class UnavailableEmailSender(ILogger<UnavailableEmailSender> logger) : IEmailSender
{
    public Task SendActivationLinkAsync(string email, string link) => Fail();
    public Task SendPasswordResetLinkAsync(string email, string link) => Fail();

    private Task Fail()
    {
        logger.LogError("Email delivery is unavailable: configure a production IEmailSender before using account email operations.");
        throw new EmailDeliveryUnavailableException();
    }
}

public sealed class EmailDeliveryUnavailableException : Exception
{
    public EmailDeliveryUnavailableException() : base("Production email delivery is not configured.") { }
}
