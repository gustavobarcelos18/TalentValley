using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed class AdminDashboardService(AppDbContext database)
{
    public async Task<AdminDashboardResponse> GetAsync(CancellationToken cancellationToken)
    {
        var activeStudents = await database.Alunos.AsNoTracking()
            .CountAsync(x => x.Ativo, cancellationToken);

        var activeRecruiters = await database.Recrutadores.AsNoTracking()
            .CountAsync(x => x.Status == StatusRecrutador.ATIVO, cancellationToken);

        var pendingRpv = await database.Formacoes.AsNoTracking()
            .CountAsync(x => x.EhRioPombaValley && x.StatusValidacaoRpv == StatusValidacaoRpv.PENDENTE, cancellationToken);

        // SQLite's EF provider does not translate DateTimeOffset ordering; compare directly in SQL.
        var cutoff = DateTimeOffset.UtcNow.AddDays(-7);
        var updatedInLast7Days = await database.Database.SqlQuery<int>($"""
            SELECT COUNT(*) AS "Value"
            FROM "Alunos" AS a
            WHERE a."Ativo" = 1 AND a."AtualizadoEm" > {cutoff}
            """).SingleAsync(cancellationToken);

        var verifiedRpv = await database.Formacoes.AsNoTracking()
            .CountAsync(x => x.EhRioPombaValley && x.StatusValidacaoRpv == StatusValidacaoRpv.VERIFICADO, cancellationToken);

        var topCompetencies = await database.AlunoCompetencias.AsNoTracking()
            .Where(x => x.Aluno.Ativo)
            .GroupBy(x => new { x.CompetenciaId, x.Competencia.Nome, x.Competencia.NomeBusca })
            .Select(g => new { g.Key.CompetenciaId, g.Key.Nome, g.Key.NomeBusca, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ThenBy(x => x.NomeBusca)
            .ThenBy(x => x.CompetenciaId)
            .Take(5)
            .Select(x => new AdminDashboardCompetenciaItem(x.CompetenciaId, x.Nome, x.Count))
            .ToListAsync(cancellationToken);

        return new(
            activeStudents,
            activeRecruiters,
            pendingRpv,
            updatedInLast7Days,
            verifiedRpv,
            topCompetencies);
    }
}
