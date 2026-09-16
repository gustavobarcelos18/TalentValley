using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace TalentValley.Api.Email;

public sealed class ResendEmailSender(HttpClient client, IOptions<ResendOptions> options,
    ILogger<ResendEmailSender> logger) : IEmailSender
{
    public Task SendActivationLinkAsync(string email, string link) =>
        SendAsync(email, "Ative sua conta no Talent Valley", $"Para ativar sua conta, acesse: {link}");

    public Task SendPasswordResetLinkAsync(string email, string link) =>
        SendAsync(email, "Redefina sua senha no Talent Valley", $"Para redefinir sua senha, acesse: {link}");

    private async Task SendAsync(string email, string subject, string body)
    {
        var sender = options.Value;
        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", sender.ApiKey);
        request.Content = JsonContent.Create(new
        {
            from = $"{sender.SenderName} <{sender.SenderAddress}>",
            to = new[] { email },
            subject,
            text = body
        });

        try
        {
            using var response = await client.SendAsync(request);
            if (response.IsSuccessStatusCode) return;
            logger.LogError("Resend email delivery failed with HTTP status {StatusCode}.", (int)response.StatusCode);
        }
        catch (HttpRequestException)
        {
            logger.LogError("Resend email delivery failed due to a network error.");
        }
        catch (TaskCanceledException)
        {
            logger.LogError("Resend email delivery timed out.");
        }

        throw new EmailDeliveryUnavailableException();
    }
}
