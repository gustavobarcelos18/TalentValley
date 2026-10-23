using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed class AuditoriaService(AppDbContext database, IHttpContextAccessor httpContext)
{
    // Demonstration setup entries stay recorded but are not listed: the list describes the real platform.
    private static readonly AcaoAuditoria[] DemoActions = [AcaoAuditoria.DEMO_PREPARADA, AcaoAuditoria.DEMO_RESTAURADA];

    // Stage the entry; the caller saves it inside the administrative operation's transaction.
    public async Task RecordAsync(AcaoAuditoria action, string entityType, Guid entityId, string description)
    {
        var principal = httpContext.HttpContext?.User;
        if (principal?.Identity?.IsAuthenticated != true || !principal.IsInRole(AppRoles.Admin) ||
            !Guid.TryParse(principal.FindFirst("sub")?.Value, out var adminId))
            throw new InvalidOperationException("An authenticated administrator is required for auditing.");
        await RecordForAdminAsync(adminId, action, entityType, entityId, description);
    }

    // For the way back from a demonstration session: the caller is a demo account, so the administrator
    // (already verified against the database by the caller) is named explicitly.
    public async Task RecordForAdminAsync(Guid adminId, AcaoAuditoria action, string entityType, Guid entityId,
        string description)
    {
        var email = await database.Users.Where(x => x.Id == adminId).Select(x => x.Email).SingleAsync();
        database.Auditorias.Add(new Auditoria
        {
            Id = Guid.NewGuid(), AdminUserId = adminId, AdminEmailSnapshot = email!, Acao = action,
            EntidadeTipo = entityType, EntidadeId = entityId.ToString(), Descricao = description,
            CriadoEm = DateTimeOffset.UtcNow
        });
    }

    // Actions taken by the data subject (not an admin): no admin link, and no personal data in the actor snapshot.
    public const string StudentSelfServiceActor = "Próprio aluno";
    public const string RecruiterSelfServiceActor = "Próprio recrutador";

    public void RecordSelfService(AcaoAuditoria action, string actor, string entityType, Guid entityId,
        string description) =>
        database.Auditorias.Add(new Auditoria
        {
            Id = Guid.NewGuid(), AdminUserId = null, AdminEmailSnapshot = actor, Acao = action,
            EntidadeTipo = entityType, EntidadeId = entityId.ToString(), Descricao = description,
            CriadoEm = DateTimeOffset.UtcNow
        });

    public const string FormationEntityType = "FORMACAO";
    public const string RegistrationRequestEntityType = "SOLICITACAO_CADASTRO";

    // LGPD: once a person is erased, no audit entry may keep their name. Description without any personal data;
    // null for actions whose text never carries a person's name.
    public static string? NamelessDescription(AcaoAuditoria action, string entityId) => action switch
    {
        AcaoAuditoria.ALUNO_CRIADO => "Aluno criado.",
        AcaoAuditoria.ALUNO_BLOQUEADO => "Aluno bloqueado.",
        AcaoAuditoria.ALUNO_REATIVADO => "Aluno reativado.",
        AcaoAuditoria.ALUNO_EXCLUIDO => $"Aluno {entityId} excluído.",
        AcaoAuditoria.RECRUTADOR_CRIADO => "Recrutador criado.",
        AcaoAuditoria.RECRUTADOR_BLOQUEADO => "Recrutador bloqueado.",
        AcaoAuditoria.RECRUTADOR_REATIVADO => "Recrutador reativado.",
        AcaoAuditoria.RECRUTADOR_EXCLUIDO => $"Recrutador {entityId} excluído.",
        AcaoAuditoria.SOLICITACAO_CADASTRO_APROVADA => "Solicitação de cadastro aprovada.",
        AcaoAuditoria.SOLICITACAO_CADASTRO_REJEITADA => "Solicitação de cadastro rejeitada.",
        AcaoAuditoria.FORMACAO_RPV_APROVADA => "Formação RPV aprovada.",
        AcaoAuditoria.FORMACAO_RPV_REJEITADA => "Formação RPV rejeitada.",
        AcaoAuditoria.FORMACAO_RPV_VALIDACAO_REMOVIDA => "Validação de formação RPV removida.",
        _ => null
    };

    // Rewrites the earlier entries about the erased person's records (account, registration requests,
    // formations) without their name. Stages the change; the caller saves it with the deletion.
    public async Task RemoveNamesAsync(string entityType, IReadOnlyCollection<Guid> entityIds,
        CancellationToken cancellationToken = default)
    {
        if (entityIds.Count == 0) return;
        var ids = entityIds.Select(x => x.ToString()).ToList();
        var entries = await database.Auditorias
            .Where(x => x.EntidadeTipo == entityType && ids.Contains(x.EntidadeId)).ToListAsync(cancellationToken);
        foreach (var entry in entries)
            entry.Descricao = NamelessDescription(entry.Acao, entry.EntidadeId) ?? entry.Descricao;
    }

    public async Task<PaginatedResponse<AuditoriaListItem>> ListAsync(int page)
    {
        var query = database.Auditorias.AsNoTracking().Where(x => !DemoActions.Contains(x.Acao));
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(x => x.CriadoEm).ThenBy(x => x.Id)
            .Skip((page - 1) * 20).Take(20)
            .Select(x => new AuditoriaListItem(x.Id, x.Acao, x.AdminEmailSnapshot, x.EntidadeTipo,
                x.EntidadeId, x.Descricao, x.CriadoEm)).ToListAsync();
        return new(items, page, 20, total, (int)Math.Ceiling(total / 20d));
    }
}
