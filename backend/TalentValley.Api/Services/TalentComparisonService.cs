using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed class TalentComparisonService(AppDbContext database, TalentDiscoveryService talents)
{
    public async Task<TalentComparisonResponse?> CompareAsync(
        Guid recruiterId, string firstSlug, string secondSlug, CancellationToken cancellationToken)
    {
        var slugs = new[] { firstSlug, secondSlug };
        var students = await talents.FullQuery()
            .Where(x => x.Ativo && slugs.Contains(x.Slug))
            .ToListAsync(cancellationToken);
        if (students.Count != 2) return null;

        var bySlug = students.ToDictionary(x => x.Slug, StringComparer.Ordinal);
        if (!bySlug.TryGetValue(firstSlug, out var first) || !bySlug.TryGetValue(secondSlug, out var second))
            return null;

        var studentIds = students.Select(x => x.UserId).ToArray();
        var favoriteIds = (await database.Favoritos.AsNoTracking()
            .Where(x => x.RecrutadorId == recruiterId && studentIds.Contains(x.AlunoId))
            .Select(x => x.AlunoId).ToListAsync(cancellationToken)).ToHashSet();
        var profileA = TalentDiscoveryService.MapProfile(first, favoriteIds.Contains(first.UserId));
        var profileB = TalentDiscoveryService.MapProfile(second, favoriteIds.Contains(second.UserId));

        var competencies = profileA.Competencias.Join(
                profileB.Competencias, x => x.Id, x => x.Id, (x, _) => x)
            .OrderBy(x => NameNormalizer.Normalize(x.Nome)).ThenBy(x => x.Id).ToList();
        var availabilities = profileA.Disponibilidades.Intersect(profileB.Disponibilidades).Order().ToList();
        var modalities = profileA.Modalidades.Intersect(profileB.Modalidades).Order().ToList();
        return new(profileA, new(competencies, availabilities, modalities), profileB);
    }
}
