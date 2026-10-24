using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

// A date as LinkedIn writes it: "Jan 2024", "janeiro de 2024", "01/2024" or only "2024".
public readonly record struct LinkedInMonth(int Year, int? Month)
{
    public DateOnly Start => new(Year, Month ?? 1, 1);

    public DateOnly End => Month is { } month
        ? new(Year, month, DateTime.DaysInMonth(Year, month))
        : new(Year, 12, 31);

    // Same limits as DateYearRangeAttribute, which the profile endpoints apply to every date.
    private const int FirstAllowedYear = 1900;
    private const int AllowedFutureYears = 15;

    public bool IsInAllowedRange(DateOnly today) =>
        Year >= FirstAllowedYear && Year <= today.Year + AllowedFutureYears;
}

public sealed record CleanedText(string? Value, IReadOnlyList<string> Warnings);

// Pure rules that translate what LinkedIn wrote into the values the Talent Valley profile accepts.
// Nothing here reads the database or saves anything.
public static partial class LinkedInTranslator
{
    // Same limits as UpdateDadosBasicosRequest.Cidade.
    private const int MinCityLength = 2;
    private const int MaxCityLength = 120;

    private static readonly Dictionary<string, int> Months = new()
    {
        ["jan"] = 1, ["feb"] = 2, ["fev"] = 2, ["mar"] = 3, ["apr"] = 4, ["abr"] = 4, ["may"] = 5, ["mai"] = 5,
        ["jun"] = 6, ["jul"] = 7, ["aug"] = 8, ["ago"] = 8, ["sep"] = 9, ["set"] = 9, ["oct"] = 10, ["out"] = 10,
        ["nov"] = 11, ["dec"] = 12, ["dez"] = 12
    };

    private static readonly Dictionary<string, string> StateToUf = new()
    {
        ["acre"] = "AC", ["alagoas"] = "AL", ["amapa"] = "AP", ["amazonas"] = "AM", ["bahia"] = "BA",
        ["ceara"] = "CE", ["distrito federal"] = "DF", ["federal district"] = "DF", ["espirito santo"] = "ES",
        ["goias"] = "GO", ["maranhao"] = "MA", ["mato grosso"] = "MT", ["mato grosso do sul"] = "MS",
        ["minas gerais"] = "MG", ["para"] = "PA", ["paraiba"] = "PB", ["parana"] = "PR", ["pernambuco"] = "PE",
        ["piaui"] = "PI", ["rio de janeiro"] = "RJ", ["rio grande do norte"] = "RN", ["rio grande do sul"] = "RS",
        ["rondonia"] = "RO", ["roraima"] = "RR", ["santa catarina"] = "SC", ["sao paulo"] = "SP",
        ["sergipe"] = "SE", ["tocantins"] = "TO"
    };

    // Checked in this order: "Full professional" must win over "professional", "Limited working" over "working".
    private static readonly (string Token, NivelIdioma Nivel)[] LevelTokens =
    [
        ("NATIV", NivelIdioma.NATIVO), ("BILINGU", NivelIdioma.NATIVO),
        ("FULL", NivelIdioma.FLUENTE), ("PLENA", NivelIdioma.FLUENTE),
        ("LIMIT", NivelIdioma.INTERMEDIARIO),
        ("ELEMENTAR", NivelIdioma.BASICO), ("BASIC", NivelIdioma.BASICO),
        ("PROFESSIONAL_WORKING", NivelIdioma.AVANCADO), ("PROFISSIONAL", NivelIdioma.AVANCADO)
    ];

    private static readonly (Regex Pattern, TipoFormacao Tipo)[] FormationTypeRules =
    [
        (PostGraduationPattern(), TipoFormacao.POS_GRADUACAO),
        (TechnologistPattern(), TipoFormacao.TECNOLOGO),
        (TechnicianPattern(), TipoFormacao.TECNICO),
        (GraduationPattern(), TipoFormacao.GRADUACAO)
    ];

    [GeneratedRegex(@"^(?:(?<month>[a-z]{3,})\.?\s+(?:de\s+)?)?(?<year>[0-9]{4})$")]
    private static partial Regex NamedMonthPattern();

    [GeneratedRegex(@"^(?<month>[0-9]{1,2})/(?<year>[0-9]{4})$")]
    private static partial Regex NumericMonthPattern();

    [GeneratedRegex(@"^(?:state of|estado d[eoa])\s+")]
    private static partial Regex StatePrefixPattern();

    [GeneratedRegex(@"\bestagi\w*|\bintern(?:ship)?s?\b")]
    private static partial Regex InternPattern();

    [GeneratedRegex(@"\bpos\b|especializac|\bmba\b|mestrado|\bmaster(?:'?s| of| in| degree)\b|doutorado")]
    private static partial Regex PostGraduationPattern();

    [GeneratedRegex(@"tecnologo|tecnologia em")]
    private static partial Regex TechnologistPattern();

    [GeneratedRegex(@"tecnico|technician")]
    private static partial Regex TechnicianPattern();

    [GeneratedRegex(@"bacharel|licenciatura|graduacao|bachelor|engenharia")]
    private static partial Regex GraduationPattern();

    [GeneratedRegex(@"[ \t]{2,}")]
    private static partial Regex RepeatedSpacesPattern();

    [GeneratedRegex(@"\s+")]
    private static partial Regex WhitespacePattern();

    // NameNormalizer cannot handle code points that are not characters (for example U+FFFE), and a file can hold
    // them, so they are dropped before any text from the export is normalized.
    public static string Normalize(string text) => NameNormalizer.Normalize(WithoutUnassigned(text));

    private static string WithoutUnassigned(string text)
    {
        var builder = new StringBuilder(text.Length);
        foreach (var rune in text.EnumerateRunes())
        {
            if (Rune.GetUnicodeCategory(rune) != UnicodeCategory.OtherNotAssigned) builder.Append(rune.ToString());
        }

        return builder.ToString();
    }

    // The end date LinkedIn shows for a position that has not ended.
    public static bool IsOngoingText(string? text) =>
        !string.IsNullOrWhiteSpace(text) && Normalize(text) is "present" or "presente";

    public static LinkedInMonth? ParseMonth(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var normalized = Normalize(text);

        var numeric = NumericMonthPattern().Match(normalized);
        if (numeric.Success)
        {
            var month = int.Parse(numeric.Groups["month"].Value, CultureInfo.InvariantCulture);
            return month is >= 1 and <= 12 ? WithYear(numeric.Groups["year"].Value, month) : null;
        }

        var named = NamedMonthPattern().Match(normalized);
        if (!named.Success) return null;
        if (!named.Groups["month"].Success) return WithYear(named.Groups["year"].Value, null);
        return Months.TryGetValue(named.Groups["month"].Value[..3], out var number)
            ? WithYear(named.Groups["year"].Value, number)
            : null;
    }

    // Year 0000 cannot become a date.
    private static LinkedInMonth? WithYear(string year, int? month) =>
        int.Parse(year, CultureInfo.InvariantCulture) is var value and >= 1 ? new LinkedInMonth(value, month) : null;

    // Accepts the LinkedIn codes (NATIVE_OR_BILINGUAL, FULL_PROFESSIONAL, PROFESSIONAL_WORKING, LIMITED_WORKING,
    // ELEMENTARY) and the Portuguese texts built from the same words.
    public static NivelIdioma? ParseLanguageLevel(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var key = WhitespacePattern().Replace(Normalize(text), "_").ToUpperInvariant();
        foreach (var (token, nivel) in LevelTokens)
        {
            if (key.Contains(token, StringComparison.Ordinal)) return nivel;
        }

        return null;
    }

    public static TipoExperiencia ExperienceType(string cargo) =>
        InternPattern().IsMatch(Normalize(cargo)) ? TipoExperiencia.ESTAGIO : TipoExperiencia.PROFISSIONAL;

    public static TipoFormacao FormationType(string degreeName)
    {
        var normalized = Normalize(degreeName);
        foreach (var (pattern, tipo) in FormationTypeRules)
        {
            if (pattern.IsMatch(normalized)) return tipo;
        }

        return TipoFormacao.CURSO_LIVRE;
    }

    // "Rio Pomba, Minas Gerais, Brazil" -> ("Rio Pomba", "MG"). The country is not used: the profile only has city and UF.
    public static (string Cidade, string Uf)? ParseLocation(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var parts = text.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length < 2) return null;

        var city = parts[0];
        var uf = ToUf(parts[1]);
        var validCity = city.Length is >= MinCityLength and <= MaxCityLength && InputValidation.IsPersonOrCity(city);
        return uf is not null && validCity ? (city, uf) : null;
    }

    private static string? ToUf(string state)
    {
        if (state.Length == 2 && InputValidation.IsBrazilianUf(state)) return state.ToUpperInvariant();
        var key = StatePrefixPattern().Replace(Normalize(state), string.Empty);
        return StateToUf.GetValueOrDefault(key);
    }

    public static string? BrazilianPhone(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        var digits = InputValidation.NormalizePhone(text);
        return InputValidation.IsBrazilianPhone(digits) ? digits : null;
    }

    // Removes emoji and control characters and cuts the text at the field limit, saying what was changed.
    public static CleanedText Clean(string? text, int maxLength, bool multiline)
    {
        if (string.IsNullOrWhiteSpace(text)) return new(null, []);

        var warnings = new List<string>();
        var builder = new StringBuilder();
        var removedEmoji = false;
        foreach (var rune in text.EnumerateRunes())
        {
            if (NoEmojiAttribute.IsEmoji(rune))
                removedEmoji = true;
            else if (Rune.GetUnicodeCategory(rune) != UnicodeCategory.OtherNotAssigned)
                builder.Append(IsKept(rune, multiline) ? rune.ToString() : " ");
        }

        if (removedEmoji) warnings.Add("Emojis removidos do texto.");
        var value = Tidy(builder.ToString(), multiline);
        if (value.Length > maxLength)
        {
            value = Cut(value, maxLength);
            warnings.Add($"Texto cortado em {maxLength} caracteres.");
        }

        return new(value.Length == 0 ? null : value, warnings);
    }

    private static bool IsKept(Rune rune, bool multiline) =>
        !Rune.IsControl(rune) || (multiline && rune.Value is '\n' or '\r');

    private static string Tidy(string text, bool multiline) =>
        multiline ? RepeatedSpacesPattern().Replace(text, " ").Trim() : WhitespacePattern().Replace(text, " ").Trim();

    // Never leaves half of a surrogate pair at the end.
    private static string Cut(string text, int maxLength)
    {
        var length = char.IsHighSurrogate(text[maxLength - 1]) ? maxLength - 1 : maxLength;
        return text[..length].TrimEnd();
    }
}
