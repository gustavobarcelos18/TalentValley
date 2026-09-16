using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;
using TalentValley.Api.Email;

namespace TalentValley.Api.Tests;

public sealed class BrevoEmailSenderTests
{
    [Fact]
    public async Task Sends_activation_and_reset_links_to_brevo()
    {
        var requests = new List<(Uri Uri, string? ApiKey, JsonElement Payload)>();
        using var client = new HttpClient(new StubHandler(async request =>
        {
            var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync()).RootElement.Clone();
            requests.Add((request.RequestUri!, request.Headers.GetValues("api-key").Single(), payload));
            return new HttpResponseMessage(HttpStatusCode.Created);
        }));
        var logger = new RecordingLogger<BrevoEmailSender>();
        var sender = CreateSender(client, logger);
        var activation = "https://talent.example/ativar-conta?email=maria%40example.test&token=activation-secret";
        var reset = "https://talent.example/redefinir-senha?email=maria%40example.test&token=reset-secret";

        await sender.SendActivationLinkAsync("maria@example.test", activation);
        await sender.SendPasswordResetLinkAsync("maria@example.test", reset);

        Assert.Equal(2, requests.Count);
        Assert.All(requests, request =>
        {
            Assert.Equal("https://api.brevo.com/v3/smtp/email", request.Uri.ToString());
            Assert.Equal("test-api-key", request.ApiKey);
            Assert.Equal("no-reply@example.test", request.Payload.GetProperty("sender").GetProperty("email").GetString());
            Assert.Equal("Talent Valley", request.Payload.GetProperty("sender").GetProperty("name").GetString());
            Assert.Equal("maria@example.test", request.Payload.GetProperty("to")[0].GetProperty("email").GetString());
        });
        Assert.Contains("Ative sua conta", requests[0].Payload.GetProperty("subject").GetString());
        Assert.Contains(activation, requests[0].Payload.GetProperty("textContent").GetString());
        Assert.Contains("Redefina sua senha", requests[1].Payload.GetProperty("subject").GetString());
        Assert.Contains(reset, requests[1].Payload.GetProperty("textContent").GetString());
        Assert.Empty(logger.Messages);
    }

    [Fact]
    public async Task Rejected_delivery_logs_status_without_secrets()
    {
        using var client = new HttpClient(new StubHandler(_ => Task.FromResult(
            new HttpResponseMessage(HttpStatusCode.BadRequest)
            { Content = new StringContent("activation-secret test-api-key") })));
        var logger = new RecordingLogger<BrevoEmailSender>();
        var sender = CreateSender(client, logger);

        await Assert.ThrowsAsync<EmailDeliveryUnavailableException>(() => sender.SendActivationLinkAsync(
            "maria@example.test", "https://talent.example/ativar-conta?token=activation-secret"));

        Assert.Single(logger.Messages);
        Assert.Contains("400", logger.Messages[0]);
        Assert.DoesNotContain("activation-secret", logger.Messages[0]);
        Assert.DoesNotContain("test-api-key", logger.Messages[0]);
        Assert.DoesNotContain("https://talent.example", logger.Messages[0]);
    }

    private static BrevoEmailSender CreateSender(HttpClient client, RecordingLogger<BrevoEmailSender> logger) =>
        new(client, Options.Create(new BrevoOptions
        {
            ApiKey = "test-api-key", SenderAddress = "no-reply@example.test", SenderName = "Talent Valley"
        }), logger);

    private sealed class StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handle) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            handle(request);
    }
}
