using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text;

namespace TalentValley.Api.DTOs;

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Field | AttributeTargets.Parameter)]
public sealed class NoEmojiAttribute : ValidationAttribute
{
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is not string text || !ContainsEmoji(text))
            return ValidationResult.Success;

        return new ValidationResult(ErrorMessage ?? "Emojis não são permitidos.");
    }

    private static bool ContainsEmoji(string text)
    {
        foreach (var rune in text.EnumerateRunes())
        {
            var codePoint = rune.Value;
            if (codePoint == 0x00A9 || codePoint == 0x00AE || codePoint == 0x203C ||
                codePoint == 0x2049 || codePoint == 0x2122 || codePoint == 0x2139 ||
                codePoint == 0x24C2 || codePoint == 0x3030 || codePoint == 0x303D ||
                codePoint == 0x3297 || codePoint == 0x3299 || codePoint == 0x20E3 ||
                codePoint == 0xFE0F || codePoint == 0x200D ||
                IsInRange(codePoint, 0x2194, 0x21FF) || IsInRange(codePoint, 0x2300, 0x23FF) ||
                IsInRange(codePoint, 0x25AA, 0x27BF) || IsInRange(codePoint, 0x2934, 0x2935) ||
                IsInRange(codePoint, 0x2B00, 0x2BFF) || IsInRange(codePoint, 0x1F000, 0x1FAFF) ||
                IsInRange(codePoint, 0xE0020, 0xE007F) ||
                Rune.GetUnicodeCategory(rune) == UnicodeCategory.OtherSymbol && IsInRange(codePoint, 0x2600, 0x26FF))
                return true;
        }

        return false;
    }

    private static bool IsInRange(int value, int minimum, int maximum) =>
        value >= minimum && value <= maximum;
}
