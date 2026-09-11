namespace TalentValley.Api.Authorization;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string SigningKey { get; set; } = string.Empty;
    public double ExpirationHours { get; set; } = 8;

    public static bool HasSafeSigningKey(JwtOptions options)
    {
        try
        {
            var bytes = Convert.FromBase64String(options.SigningKey);
            return bytes.Length >= 32 && bytes.Distinct().Count() >= 16;
        }
        catch (FormatException) { return false; }
    }
}
