using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;

namespace TalentValley.Api.Services;

public sealed partial class SlugService(AppDbContext database)
{
    public static string BaseSlug(string name)
    {
        var slug = Separators().Replace(NameNormalizer.Normalize(name), "-").Trim('-');
        return slug.Length == 0 ? "aluno" : slug[..Math.Min(slug.Length, 180)].TrimEnd('-');
    }

    public async Task<string> GenerateAsync(string name)
    {
        var root = BaseSlug(name);
        var candidate = root;
        for (var number = 2; await database.Alunos.AnyAsync(x => x.Slug == candidate); number++)
        {
            var suffix = "-" + number.ToString(CultureInfo.InvariantCulture);
            candidate = root[..Math.Min(root.Length, 180 - suffix.Length)].TrimEnd('-') + suffix;
        }
        return candidate;
    }

    [GeneratedRegex(@"[^\p{L}\p{Nd}]+")]
    private static partial Regex Separators();
}
