using System.Net.Http.Json;
using Microsoft.Extensions.Options;
using TalentValley.Api.Services;

namespace TalentValley.Api.Email;

public sealed class BrevoEmailSender(HttpClient client, IOptions<BrevoOptions> options,
    IOptions<FrontendOptions> frontend, ILogger<BrevoEmailSender> logger) : IEmailSender
{
    public Task SendActivationLinkAsync(string email, string link) =>
        SendAsync(email, TalentValleyEmailTemplates.BuildActivation(LogoUrl(), link));

    public Task SendPasswordResetLinkAsync(string email, string link) =>
        SendAsync(email, TalentValleyEmailTemplates.BuildPasswordReset(LogoUrl(), link));

    private string LogoUrl() => frontend.Value.BaseUrl.TrimEnd('/') + "/brand/talent-valley-email.png";

    private async Task SendAsync(string email, TalentValleyEmailTemplates.Content content)
    {
        var sender = options.Value;
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
        request.Headers.Add("api-key", sender.ApiKey);
        request.Content = JsonContent.Create(new
        {
            sender = new { email = sender.SenderAddress, name = sender.SenderName },
            to = new[] { new { email } },
            subject = content.Subject,
            textContent = content.TextContent,
            htmlContent = content.HtmlContent
        });

        try
        {
            using var response = await client.SendAsync(request);
            if (response.IsSuccessStatusCode) return;
            logger.LogError("Brevo email delivery failed with HTTP status {StatusCode}.", (int)response.StatusCode);
        }
        catch (HttpRequestException)
        {
            logger.LogError("Brevo email delivery failed due to a network error.");
        }
        catch (TaskCanceledException)
        {
            logger.LogError("Brevo email delivery timed out.");
        }

        throw new EmailDeliveryUnavailableException();
    }
}
