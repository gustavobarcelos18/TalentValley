using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace TalentValley.Api.Email;

public sealed class BrevoEmailSender(HttpClient client, IOptions<BrevoOptions> options,
    ILogger<BrevoEmailSender> logger) : IEmailSender
{
    public Task SendActivationLinkAsync(string email, string link) =>
        SendAsync(email, "Ative sua conta no Talent Valley", $"Para ativar sua conta, acesse: {link}");

    public Task SendPasswordResetLinkAsync(string email, string link) =>
        SendAsync(email, "Redefina sua senha no Talent Valley", $"Para redefinir sua senha, acesse: {link}");

    private async Task SendAsync(string email, string subject, string body)
    {
        var sender = options.Value;
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
        request.Headers.Add("api-key", sender.ApiKey);
        request.Content = JsonContent.Create(new
        {
            sender = new { email = sender.SenderAddress, name = sender.SenderName },
            to = new[] { new { email } },
            subject,
            textContent = body
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
