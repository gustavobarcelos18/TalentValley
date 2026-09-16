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

    [GeneratedRegex(@"^[\p{L}][\p{L}\p{M}'’ -]*$")]
    private static partial Regex PersonOrCityRegex();

    [GeneratedRegex(@"^\d{10,11}$")]
    private static partial Regex PhoneRegex();

    public static bool IsPersonOrCity(string value) =>
        !HasControlCharacters(value) && PersonOrCityRegex().IsMatch(value);

    public static bool IsBrazilianUf(string value) => BrazilianUfs.Contains(value.ToUpperInvariant());

    public static bool IsBrazilianPhone(string value) =>
        PhoneRegex().IsMatch(value) && value[..2] != "00" && value.Distinct().Count() > 1;

    public static bool IsSafeHttpUrl(string value) =>
        !HasControlCharacters(value) && Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
        (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps) && !string.IsNullOrWhiteSpace(uri.Host);

    public static bool IsSafeEmail(string value) =>
        !string.IsNullOrWhiteSpace(value) && !value.Any(char.IsWhiteSpace) &&
        new EmailAddressAttribute().IsValid(value);

    public static bool IsMeaningfulText(string value) =>
        !HasControlCharacters(value) && value.Any(char.IsLetterOrDigit);

    public static bool HasControlCharacters(string value) => value.Any(char.IsControl);

    public static string NormalizePhone(string? value) => new string((value ?? string.Empty).Where(char.IsDigit).ToArray()) switch
    {
        var digits when digits.Length > 11 && digits.StartsWith("55", StringComparison.Ordinal) => digits[2..Math.Min(digits.Length, 13)],
        var digits => digits[..Math.Min(digits.Length, 11)]
    };
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
    public override bool IsValid(object? value) => value is string text && InputValidation.IsBrazilianPhone(InputValidation.NormalizePhone(text));
}

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class SafeHttpUrlAttribute : ValidationAttribute
{
    public SafeHttpUrlAttribute() => ErrorMessage = "Informe uma URL começando com http:// ou https://.";
    public override bool IsValid(object? value) => value is null || value is string text && InputValidation.IsSafeHttpUrl(text);
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
    public NoControlCharactersAttribute() => ErrorMessage = "O texto informado contém caracteres inválidos.";
    public override bool IsValid(object? value) => value is null || value is string text && !InputValidation.HasControlCharacters(text);
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
