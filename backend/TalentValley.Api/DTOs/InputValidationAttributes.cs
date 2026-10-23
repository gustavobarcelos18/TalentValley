using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace TalentValley.Api.DTOs;

/// <summary>Shared semantic validation for mutable API DTOs.</summary>
public static partial class InputValidation
{
    private static readonly HashSet<string> BrazilianUfs = new(StringComparer.Ordinal)
    {
        "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
        "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
        "SP", "SE", "TO"
    };

    // Decision D5: only the official CNPq Lattes hosts are accepted for LattesUrl.
    private static readonly HashSet<string> LattesHosts = new(StringComparer.OrdinalIgnoreCase)
    {
        "lattes.cnpq.br", "buscatextual.cnpq.br"
    };

    [GeneratedRegex(@"^[\p{L}][\p{L}\p{M}'’ -]*$")]
    private static partial Regex PersonOrCityRegex();

    [GeneratedRegex(@"^\d{10,11}$")]
    private static partial Regex PhoneRegex();

    [GeneratedRegex(@"^[0-9 ()+.\-]+$")]
    private static partial Regex PhoneInputRegex();

    public static bool IsPersonOrCity(string value) =>
        !HasControlCharacters(value) && PersonOrCityRegex().IsMatch(value);

    public static bool IsBrazilianUf(string value) => BrazilianUfs.Contains(value.ToUpperInvariant());

    // Area codes run from 11 to 99. After the area code, a mobile number (11 digits) starts with 9
    // and a landline (10 digits) starts with 2 to 5.
    public static bool IsBrazilianPhone(string value) =>
        PhoneRegex().IsMatch(value) && value.Distinct().Count() > 1 &&
        value[0] != '0' && !value.StartsWith("10", StringComparison.Ordinal) &&
        (value.Length == 11 ? value[2] == '9' : value[2] is >= '2' and <= '5');

    public static bool IsValidPhoneInput(string value) =>
        PhoneInputRegex().IsMatch(value) && IsBrazilianPhone(NormalizePhone(value));

    public static bool IsSafeHttpUrl(string value) =>
        !HasControlCharacters(value) && Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps) && !string.IsNullOrWhiteSpace(uri.Host);

    public static bool IsLattesUrl(string value) =>
        !value.Any(char.IsWhiteSpace) && IsSafeHttpUrl(value) &&
        Uri.TryCreate(value, UriKind.Absolute, out var uri) && LattesHosts.Contains(RemoveWwwPrefix(uri.Host));

    public static bool IsSafeEmail(string value) =>
        !string.IsNullOrWhiteSpace(value) && !value.Any(char.IsWhiteSpace) &&
        new EmailAddressAttribute().IsValid(value);

    public static bool IsMeaningfulText(string value) =>
        !HasControlCharacters(value) && value.Any(char.IsLetterOrDigit);

    public static bool HasControlCharacters(string value) => value.Any(char.IsControl);

    private static string RemoveWwwPrefix(string host) =>
        host.StartsWith("www.", StringComparison.OrdinalIgnoreCase) ? host[4..] : host;

    public static string NormalizePhone(string? value)
    {
        var digits = new string((value ?? string.Empty).Where(c => c is >= '0' and <= '9').ToArray());

        // Accept an optional Brazilian country code, but never discard submitted digits.
        // Validation must reject an overlong number instead of silently changing it.
        return digits.Length is 12 or 13 && digits.StartsWith("55", StringComparison.Ordinal)
            ? digits[2..]
            : digits;
    }
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class PersonNameAttribute : ValidationAttribute
{
    public PersonNameAttribute() => ErrorMessage = "Informe um nome válido, sem números.";
    public override bool IsValid(object? value) => value is string text && InputValidation.IsPersonOrCity(text);
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class CityNameAttribute : ValidationAttribute
{
    public CityNameAttribute() => ErrorMessage = "Informe uma cidade válida, sem números.";
    public override bool IsValid(object? value) => value is string text && InputValidation.IsPersonOrCity(text);
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class BrazilianUfAttribute : ValidationAttribute
{
    public BrazilianUfAttribute() => ErrorMessage = "Selecione uma UF válida.";
    public override bool IsValid(object? value) => value is null || value is string text && InputValidation.IsBrazilianUf(text);
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class BrazilianPhoneAttribute : ValidationAttribute
{
    public BrazilianPhoneAttribute() => ErrorMessage = "Informe um telefone brasileiro válido.";
    public override bool IsValid(object? value) => value is null || value is string text && InputValidation.IsValidPhoneInput(text);
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class SafeHttpUrlAttribute : ValidationAttribute
{
    public SafeHttpUrlAttribute() => ErrorMessage = "Informe uma URL começando com http:// ou https://.";
    public override bool IsValid(object? value) => value is null || value is string text && InputValidation.IsSafeHttpUrl(text);
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class LattesUrlAttribute : ValidationAttribute
{
    private static readonly NoEmojiAttribute NoEmoji = new();

    public LattesUrlAttribute() =>
        ErrorMessage = "Informe um link do currículo Lattes (lattes.cnpq.br ou buscatextual.cnpq.br).";
    public override bool IsValid(object? value) =>
        value is null || value is string text && InputValidation.IsLattesUrl(text) && NoEmoji.IsValid(text);
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class SafeEmailAttribute : ValidationAttribute
{
    public SafeEmailAttribute() => ErrorMessage = "Informe um e-mail válido.";
    public override bool IsValid(object? value) => value is null || value is string text && InputValidation.IsSafeEmail(text);
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class MeaningfulTextAttribute : ValidationAttribute
{
    public MeaningfulTextAttribute() => ErrorMessage = "Informe um valor válido.";
    public override bool IsValid(object? value) => value is null || value is string text && InputValidation.IsMeaningfulText(text);
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class NoControlCharactersAttribute : ValidationAttribute
{
    /// <summary>Long-text fields (bio, descriptions) accept paragraph breaks (\n and \r).</summary>
    public bool AllowLineBreaks { get; init; }

    public NoControlCharactersAttribute() => ErrorMessage = "O texto informado contém caracteres inválidos.";
    public override bool IsValid(object? value) =>
        value is null || value is string text && !InputValidation.HasControlCharacters(AllowLineBreaks ? text.Replace("\r", "").Replace("\n", "") : text);
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class YearRangeAttribute : ValidationAttribute
{
    public int Minimum { get; init; } = 1900;
    public int FutureYears { get; init; } = 15;

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is null) return ValidationResult.Success;
        if (value is int year && year >= Minimum && year <= DateTime.UtcNow.Year + FutureYears)
            return ValidationResult.Success;

        return new ValidationResult($"Informe um ano entre {Minimum} e {DateTime.UtcNow.Year + FutureYears}.");
    }
}

/// <summary>Same limits as <see cref="YearRangeAttribute"/>, applied to the year of a date.</summary>
[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class DateYearRangeAttribute : ValidationAttribute
{
    public int Minimum { get; init; } = 1900;
    public int FutureYears { get; init; } = 15;

    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is null) return ValidationResult.Success;
        if (value is DateOnly date && date.Year >= Minimum && date.Year <= DateTime.UtcNow.Year + FutureYears)
            return ValidationResult.Success;

        return new ValidationResult($"Informe uma data entre {Minimum} e {DateTime.UtcNow.Year + FutureYears}.");
    }
}
