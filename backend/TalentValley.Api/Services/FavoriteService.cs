using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed class FavoriteService(AppDbContext database, TalentDiscoveryService talents)
{
    private const int PageSize = 10;

    public async Task<bool> AddAsync(Guid recruiterId, string slug, CancellationToken cancellationToken)
    {
        var studentId = await database.Alunos.AsNoTracking()
            .Where(x => x.Ativo && x.Slug == slug)
            .Select(x => (Guid?)x.UserId)
            .SingleOrDefaultAsync(cancellationToken);
        if (studentId is null) return false;

        // The composite key is the idempotency boundary. INSERT OR IGNORE also makes
        // competing requests converge without surfacing a unique-key exception.
        var inserted = await database.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT OR IGNORE INTO "Favoritos" ("RecrutadorId", "AlunoId", "CriadoEm")
            SELECT {recruiterId}, a."UserId", {DateTimeOffset.UtcNow}
            FROM "Alunos" AS a
            WHERE a."UserId" = {studentId.Value} AND a."Ativo" = 1
            """, cancellationToken);
        if (inserted > 0) return true;
        return await database.Alunos.AsNoTracking()
            .AnyAsync(x => x.UserId == studentId.Value && x.Ativo, cancellationToken);
    }

    public async Task<bool> RemoveAsync(Guid recruiterId, string slug, CancellationToken cancellationToken)
    {
        var studentId = await database.Alunos.AsNoTracking()
            .Where(x => x.Ativo && x.Slug == slug)
            .Select(x => (Guid?)x.UserId)
            .SingleOrDefaultAsync(cancellationToken);
        if (studentId is null) return false;

        await database.Favoritos
            .Where(x => x.RecrutadorId == recruiterId && x.AlunoId == studentId.Value)
            .ExecuteDeleteAsync(cancellationToken);
        return true;
    }

    public async Task<PaginatedResponse<FavoriteTalentResponse>> ListAsync(
        Guid recruiterId, int page, CancellationToken cancellationToken)
    {
        var visible = database.Favoritos.AsNoTracking()
            .Where(x => x.RecrutadorId == recruiterId && x.Aluno.Ativo);
        var total = await visible.CountAsync(cancellationToken);
        var items = await LoadRecentAsync(recruiterId, PageSize, (page - 1) * PageSize, cancellationToken);
        return new(items, page, PageSize, total, (int)Math.Ceiling(total / (double)PageSize));
    }

    public async Task<IReadOnlyCollection<FavoriteTalentResponse>> LoadRecentAsync(
        Guid recruiterId, int limit, int offset, CancellationToken cancellationToken)
    {
        var ids = await database.Database.SqlQuery<Guid>($"""
            SELECT f."AlunoId" AS "Value"
            FROM "Favoritos" AS f
            INNER JOIN "Alunos" AS a ON a."UserId" = f."AlunoId"
            INNER JOIN "AspNetUsers" AS u ON u."Id" = a."UserId"
            WHERE f."RecrutadorId" = {recruiterId} AND a."Ativo" = 1
            ORDER BY f."CriadoEm" DESC, u."NomeBusca" ASC, a."UserId" ASC
            LIMIT {limit} OFFSET {offset}
            """).ToListAsync(cancellationToken);
        if (ids.Count == 0) return [];

        var favoriteDates = await database.Favoritos.AsNoTracking()
            .Where(x => x.RecrutadorId == recruiterId && ids.Contains(x.AlunoId))
            .ToDictionaryAsync(x => x.AlunoId, x => x.CriadoEm, cancellationToken);
        var students = await talents.PreviewQuery().Where(x => ids.Contains(x.UserId))
            .ToDictionaryAsync(x => x.UserId, cancellationToken);
        return ids.Select(id => new FavoriteTalentResponse(
            favoriteDates[id], TalentDiscoveryService.MapListItem(students[id], true))).ToList();
    }
}
