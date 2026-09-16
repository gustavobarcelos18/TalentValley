namespace TalentValley.Api.Email;

public sealed class ResendOptions
{
    public string? ApiKey { get; set; }
    public string? SenderAddress { get; set; }
    public string? SenderName { get; set; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(ApiKey) &&
        !string.IsNullOrWhiteSpace(SenderAddress) && !string.IsNullOrWhiteSpace(SenderName);
}
