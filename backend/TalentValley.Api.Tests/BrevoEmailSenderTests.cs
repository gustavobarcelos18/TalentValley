using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;
using TalentValley.Api.Email;
using TalentValley.Api.Services;

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

        var activationPayload = requests[0].Payload;
        var resetPayload = requests[1].Payload;

        Assert.Equal("Ative sua conta no Talent Valley", activationPayload.GetProperty("subject").GetString());
        Assert.Equal("Redefina sua senha no Talent Valley", resetPayload.GetProperty("subject").GetString());

        var activationText = activationPayload.GetProperty("textContent").GetString()!;
        var resetText = resetPayload.GetProperty("textContent").GetString()!;
        Assert.Contains(activation, activationText);
        Assert.Contains(reset, resetText);

        var activationHtml = activationPayload.GetProperty("htmlContent").GetString()!;
        var resetHtml = resetPayload.GetProperty("htmlContent").GetString()!;
        Assert.Contains(WebUtility.HtmlEncode(activation), activationHtml);
        Assert.Contains(WebUtility.HtmlEncode(reset), resetHtml);

        // Call-to-action, distinct copy and approved branding.
        Assert.Contains("Criar minha senha", activationHtml);
        Assert.Contains("Redefinir minha senha", resetHtml);
        Assert.Contains("SEU ACESSO ESTÁ PRONTO", activationHtml);
        Assert.Contains("REDEFINIÇÃO DE SENHA", resetHtml);
        Assert.DoesNotContain("SEU ACESSO ESTÁ PRONTO", resetHtml);
        Assert.Contains("Talent Valley", activationHtml);
        Assert.Contains("Rio Pomba Valley", activationHtml);
        Assert.Contains("TALENTOS · CONEXÕES · OPORTUNIDADES", activationHtml);

        // Official logo is referenced through the configured frontend base URL.
        Assert.Contains("https://talent.example/brand/talent-valley-email.png", activationHtml);
        Assert.Contains("https://talent.example/brand/talent-valley-email.png", resetHtml);

        Assert.NotEqual(activationHtml, resetHtml);
        Assert.NotEqual(activationText, resetText);

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

    [Fact]
    public async Task Html_encodes_special_characters_but_keeps_plain_text_url()
    {
        var requests = new List<JsonElement>();
        using var client = new HttpClient(new StubHandler(async request =>
        {
            var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync()).RootElement.Clone();
            requests.Add(payload);
            return new HttpResponseMessage(HttpStatusCode.Created);
        }));
        var logger = new RecordingLogger<BrevoEmailSender>();
        var sender = CreateSender(client, logger);
        var link = "https://talent.example/ativar-conta?email=maria%40example.test&token=\"><img src=x onerror=alert(1)>";

        await sender.SendActivationLinkAsync("maria@example.test", link);

        var html = requests[0].GetProperty("htmlContent").GetString()!;
        var text = requests[0].GetProperty("textContent").GetString()!;

        // The plain-text alternative keeps the exact original URL.
        Assert.Contains(link, text);

        // The HTML href/fallback is safely encoded and cannot break out of the attribute.
        Assert.Contains("&amp;token=", html);
        Assert.Contains("&quot;&gt;&lt;img src=x onerror=alert(1)&gt;", html);
        Assert.DoesNotContain("\"><img", html);
    }

    [Fact]
    public async Task Encodes_frontend_base_url_in_logo_markup()
    {
        var requests = new List<JsonElement>();
        using var client = new HttpClient(new StubHandler(async request =>
        {
            var payload = JsonDocument.Parse(await request.Content!.ReadAsStringAsync()).RootElement.Clone();
            requests.Add(payload);
            return new HttpResponseMessage(HttpStatusCode.Created);
        }));
        var logger = new RecordingLogger<BrevoEmailSender>();
        var sender = CreateSender(client, logger, baseUrl: "https://talent.example\"><script>alert(1)</script>");

        await sender.SendPasswordResetLinkAsync("maria@example.test", "https://talent.example/redefinir-senha?token=reset-secret");

        var html = requests[0].GetProperty("htmlContent").GetString()!;
        Assert.Contains("https://talent.example&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;/brand/talent-valley-email.png", html);
        Assert.DoesNotContain("<script>alert(1)</script>", html);
    }

    private static BrevoEmailSender CreateSender(HttpClient client, RecordingLogger<BrevoEmailSender> logger,
        string baseUrl = "https://talent.example") =>
        new(client, Options.Create(new BrevoOptions
        {
            ApiKey = "test-api-key", SenderAddress = "no-reply@example.test", SenderName = "Talent Valley"
        }), Options.Create(new FrontendOptions { BaseUrl = baseUrl }), logger);

    private sealed class StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handle) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            handle(request);
    }
}
