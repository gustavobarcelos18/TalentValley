using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed class AuditoriaService(AppDbContext database, IHttpContextAccessor httpContext)
{
    // Stage the entry; the caller saves it inside the administrative operation's transaction.
    public async Task RecordAsync(AcaoAuditoria action, string entityType, Guid entityId, string description)
    {
        var principal = httpContext.HttpContext?.User;
        if (principal?.Identity?.IsAuthenticated != true || !principal.IsInRole(AppRoles.Admin) ||
            !Guid.TryParse(principal.FindFirst("sub")?.Value, out var adminId))
            throw new InvalidOperationException("An authenticated administrator is required for auditing.");

        var email = await database.Users.Where(x => x.Id == adminId).Select(x => x.Email).SingleAsync();
        database.Auditorias.Add(new Auditoria
        {
            Id = Guid.NewGuid(), AdminUserId = adminId, AdminEmailSnapshot = email!, Acao = action,
            EntidadeTipo = entityType, EntidadeId = entityId.ToString(), Descricao = description,
            CriadoEm = DateTimeOffset.UtcNow
        });
    }

    public async Task<PaginatedResponse<AuditoriaListItem>> ListAsync(int page)
    {
        var query = database.Auditorias.AsNoTracking();
        var total = await query.CountAsync();
        var items = await query.OrderByDescending(x => x.CriadoEm).ThenBy(x => x.Id)
            .Skip((page - 1) * 20).Take(20)
            .Select(x => new AuditoriaListItem(x.Id, x.Acao, x.AdminEmailSnapshot, x.EntidadeTipo,
                x.EntidadeId, x.Descricao, x.CriadoEm)).ToListAsync();
        return new(items, page, 20, total, (int)Math.Ceiling(total / 20d));
    }
}
