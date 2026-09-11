using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace TalentValley.Api.Services;

public static partial class NameNormalizer
{
    public static string Normalize(string name)
    {
        var decomposed = name.Normalize(NormalizationForm.FormD);
        var text = new StringBuilder();
        foreach (var character in decomposed)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
                text.Append(character);
        }

        return Whitespace().Replace(text.ToString().Normalize(NormalizationForm.FormC).Trim(), " ")
            .ToLowerInvariant();
    }

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
