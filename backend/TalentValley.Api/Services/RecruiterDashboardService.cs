using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed class RecruiterDashboardService(AppDbContext database, FavoriteService favorites)
{
    public async Task<RecruiterDashboardResponse> GetAsync(Guid recruiterId, CancellationToken cancellationToken)
    {
        var boundary = await database.Users.AsNoTracking()
            .Where(x => x.Id == recruiterId)
            .Select(x => x.LoginAnteriorEm)
            .SingleAsync(cancellationToken);

        var updated = 0;
        var newStudents = 0;
        if (boundary is not null)
        {
            updated = await database.Database.SqlQuery<int>($"""
                SELECT COUNT(*) AS "Value"
                FROM "Alunos" AS a
                WHERE a."Ativo" = 1 AND a."AtualizadoEm" > {boundary.Value}
                """).SingleAsync(cancellationToken);
            newStudents = await database.Database.SqlQuery<int>($"""
                SELECT COUNT(*) AS "Value"
                FROM "Alunos" AS a
                INNER JOIN "AspNetUsers" AS u ON u."Id" = a."UserId"
                WHERE a."Ativo" = 1 AND u."CriadoEm" > {boundary.Value}
                """).SingleAsync(cancellationToken);
        }

        var favoriteCount = await database.Favoritos.AsNoTracking()
            .CountAsync(x => x.RecrutadorId == recruiterId && x.Aluno.Ativo, cancellationToken);
        var recent = await favorites.LoadRecentAsync(recruiterId, 5, 0, cancellationToken);
        return new(boundary, new(updated, newStudents, favoriteCount), recent);
    }
}
