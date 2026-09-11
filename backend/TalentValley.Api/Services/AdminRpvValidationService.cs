using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Services;

public enum RpvValidationTransitionResult
{
    Success,
    NotFound,
    InvalidTransition,
    CertificateRequired,
    CertificateUnavailable
}

public sealed class AdminRpvValidationService(
    AppDbContext database,
    AuditoriaService audit,
    IFileStorage storage,
    ILogger<AdminRpvValidationService> logger)
{
    private const int PageSize = 10;
    private const string EntityType = "FORMACAO";

    public async Task<PaginatedResponse<RpvValidationListItem>> ListPendingAsync(
        int page,
        CancellationToken cancellationToken)
    {
        var query = database.Formacoes.AsNoTracking()
            .Where(x => x.EhRioPombaValley && x.StatusValidacaoRpv == StatusValidacaoRpv.PENDENTE);
        var total = await query.CountAsync(cancellationToken);
        // SQLite stores UTC DateTimeOffset values as sortable ISO text but its EF provider does not
        // translate DateTimeOffset ordering. Select just the page IDs in SQL, then load that page.
        // AtualizadoEm is the existing timestamp for entry/re-entry into review.
        var offset = (page - 1) * PageSize;
        var orderedIds = await database.Database.SqlQuery<Guid>($"""
            SELECT f."Id" AS "Value"
            FROM "Formacoes" AS f
            INNER JOIN "Alunos" AS a ON a."UserId" = f."AlunoId"
            INNER JOIN "AspNetUsers" AS u ON u."Id" = a."UserId"
            WHERE f."EhRioPombaValley" = 1 AND f."StatusValidacaoRpv" = 'PENDENTE'
            ORDER BY f."AtualizadoEm", u."NomeBusca", f."Id"
            LIMIT {PageSize} OFFSET {offset}
            """).ToListAsync(cancellationToken);
        var unorderedItems = await query
            .Where(x => orderedIds.Contains(x.Id))
            .Select(x => new RpvValidationListItem(
                x.Id,
                x.AlunoId,
                x.Aluno.User.NomeCompleto,
                x.Aluno.Slug,
                x.Aluno.Ativo,
                x.Tipo,
                x.Nome,
                x.Instituicao,
                x.DataInicio,
                x.DataFim,
                x.CargaHoraria,
                x.Status,
                x.Principal,
                x.CertificadoStorageKey != null,
                x.AtualizadoEm))
            .ToDictionaryAsync(x => x.FormacaoId, cancellationToken);
        var items = orderedIds.Select(id => unorderedItems[id]).ToList();

        return new(items, page, PageSize, total, (int)Math.Ceiling(total / (double)PageSize));
    }

    public Task<RpvValidationDetailResponse?> GetDetailAsync(Guid formacaoId, CancellationToken cancellationToken) =>
        database.Formacoes.AsNoTracking()
            .Where(x => x.Id == formacaoId && x.EhRioPombaValley && x.StatusValidacaoRpv != null)
            .Select(x => new RpvValidationDetailResponse(
                x.Id,
                new RpvValidationAlunoResponse(
                    x.AlunoId,
                    x.Aluno.User.NomeCompleto,
                    x.Aluno.Slug,
                    x.Aluno.Ativo,
                    x.Aluno.Cidade,
                    x.Aluno.Uf),
                new RpvValidationFormacaoResponse(
                    x.Tipo,
                    x.Nome,
                    x.Instituicao,
                    x.DataInicio,
                    x.DataFim,
                    x.CargaHoraria,
                    x.Status,
                    x.Principal,
                    x.EhRioPombaValley,
                    x.StatusValidacaoRpv!.Value,
                    x.CertificadoStorageKey != null,
                    x.AtualizadoEm)))
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<ProtectedFile?> OpenCertificateAsync(Guid formacaoId, CancellationToken cancellationToken)
    {
        var key = await database.Formacoes.AsNoTracking()
            .Where(x => x.Id == formacaoId && x.EhRioPombaValley)
            .Select(x => x.CertificadoStorageKey)
            .SingleOrDefaultAsync(cancellationToken);
        if (key is null) return null;

        var content = await storage.OpenReadAsync(FileCategory.Certificate, key, cancellationToken);
        return content is null ? null : new ProtectedFile(content, "application/pdf");
    }

    public async Task<RpvValidationTransitionResult> ApproveAsync(
        Guid formacaoId,
        CancellationToken cancellationToken)
    {
        var formation = await FindTransitionSnapshotAsync(formacaoId, cancellationToken);
        if (formation is null) return RpvValidationTransitionResult.NotFound;
        if (formation.Status != StatusValidacaoRpv.PENDENTE)
            return RpvValidationTransitionResult.InvalidTransition;
        if (formation.CertificateKey is null)
            return RpvValidationTransitionResult.CertificateRequired;
        if (!await storage.ExistsAsync(FileCategory.Certificate, formation.CertificateKey, cancellationToken))
        {
            logger.LogError(
                "Cannot approve RPV formation {FormationId}: certificate {StorageKey} is unavailable.",
                formacaoId,
                formation.CertificateKey);
            return RpvValidationTransitionResult.CertificateUnavailable;
        }

        return await TransitionAsync(
            formation,
            StatusValidacaoRpv.PENDENTE,
            StatusValidacaoRpv.VERIFICADO,
            DateTimeOffset.UtcNow,
            AcaoAuditoria.FORMACAO_RPV_APROVADA,
            $"Formação RPV {formation.Nome} do aluno {formation.AlunoNome} aprovada.",
            formation.CertificateKey,
            cancellationToken);
    }

    public async Task<RpvValidationTransitionResult> RejectAsync(
        Guid formacaoId,
        CancellationToken cancellationToken)
    {
        var formation = await FindTransitionSnapshotAsync(formacaoId, cancellationToken);
        if (formation is null) return RpvValidationTransitionResult.NotFound;
        if (formation.Status != StatusValidacaoRpv.PENDENTE)
            return RpvValidationTransitionResult.InvalidTransition;

        return await TransitionAsync(
            formation,
            StatusValidacaoRpv.PENDENTE,
            StatusValidacaoRpv.REJEITADO,
            DateTimeOffset.UtcNow,
            AcaoAuditoria.FORMACAO_RPV_REJEITADA,
            $"Formação RPV {formation.Nome} do aluno {formation.AlunoNome} rejeitada.",
            null,
            cancellationToken);
    }

    public async Task<RpvValidationTransitionResult> RemoveValidationAsync(
        Guid formacaoId,
        CancellationToken cancellationToken)
    {
        var formation = await FindTransitionSnapshotAsync(formacaoId, cancellationToken);
        if (formation is null) return RpvValidationTransitionResult.NotFound;
        if (formation.Status != StatusValidacaoRpv.VERIFICADO)
            return RpvValidationTransitionResult.InvalidTransition;

        return await TransitionAsync(
            formation,
            StatusValidacaoRpv.VERIFICADO,
            StatusValidacaoRpv.PENDENTE,
            null,
            AcaoAuditoria.FORMACAO_RPV_VALIDACAO_REMOVIDA,
            $"Validação da formação RPV {formation.Nome} do aluno {formation.AlunoNome} removida.",
            null,
            cancellationToken);
    }

    private Task<TransitionSnapshot?> FindTransitionSnapshotAsync(Guid formacaoId, CancellationToken cancellationToken) =>
        database.Formacoes.AsNoTracking()
            .Where(x => x.Id == formacaoId && x.EhRioPombaValley && x.StatusValidacaoRpv != null)
            .Select(x => new TransitionSnapshot(
                x.Id,
                x.Nome,
                x.Aluno.User.NomeCompleto,
                x.StatusValidacaoRpv!.Value,
                x.CertificadoStorageKey))
            .SingleOrDefaultAsync(cancellationToken);

    private async Task<RpvValidationTransitionResult> TransitionAsync(
        TransitionSnapshot formation,
        StatusValidacaoRpv expected,
        StatusValidacaoRpv next,
        DateTimeOffset? validatedAt,
        AcaoAuditoria action,
        string description,
        string? expectedCertificateKey,
        CancellationToken cancellationToken)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var candidates = database.Formacoes.Where(x =>
            x.Id == formation.Id &&
            x.EhRioPombaValley &&
            x.StatusValidacaoRpv == expected);
        if (expectedCertificateKey is not null)
            candidates = candidates.Where(x => x.CertificadoStorageKey == expectedCertificateKey);

        var changed = await candidates.ExecuteUpdateAsync(setters => setters
            .SetProperty(x => x.StatusValidacaoRpv, next)
            .SetProperty(x => x.ValidadoEm, validatedAt), cancellationToken);
        if (changed == 0)
        {
            await transaction.RollbackAsync(cancellationToken);
            return RpvValidationTransitionResult.InvalidTransition;
        }

        await audit.RecordAsync(action, EntityType, formation.Id, description);
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return RpvValidationTransitionResult.Success;
    }

    private sealed record TransitionSnapshot(
        Guid Id,
        string Nome,
        string AlunoNome,
        StatusValidacaoRpv Status,
        string? CertificateKey);
}
