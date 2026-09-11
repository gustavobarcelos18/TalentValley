namespace TalentValley.Api.Email;

public interface IEmailSender
{
    Task SendActivationLinkAsync(string email, string link);
    Task SendPasswordResetLinkAsync(string email, string link);
}
