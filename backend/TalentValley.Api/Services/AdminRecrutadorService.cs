using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed class AdminRecrutadorService(AppDbContext database, AdminAccountService accounts, AuditoriaService audit)
{
    public async Task<RecrutadorCreatedResponse> CreateAsync(CreateRecrutadorRequest request)
    {
        await accounts.EnsureEmailAvailableAsync(request.Email);
        ApplicationUser user;
        await using (var transaction = await database.Database.BeginTransactionAsync())
        {
            user = await accounts.CreateAsync(request.NomeCompleto, request.Email, AppRoles.Recruiter);
            database.Recrutadores.Add(new Recrutador
            {
                UserId = user.Id, Empresa = request.Empresa, EmpresaBusca = NameNormalizer.Normalize(request.Empresa),
                Cargo = request.Cargo, Telefone = request.Telefone, Cidade = request.Cidade, Uf = request.Uf,
                Status = StatusRecrutador.ATIVO
            });
            await audit.RecordAsync(AcaoAuditoria.RECRUTADOR_CRIADO, AppRoles.Recruiter, user.Id,
                $"Acesso do recrutador {user.NomeCompleto} criado.");
            await database.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        await accounts.TrySendActivationAsync(user);
        return new(user.Id, user.NomeCompleto, user.Email!, StatusRecrutador.ATIVO);
    }

    public async Task<PaginatedResponse<RecrutadorListItem>> ListAsync(RecrutadorListQuery request)
    {
        var query = database.Recrutadores.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = NameNormalizer.Normalize(request.Search);
            query = query.Where(x => x.User.NomeBusca.Contains(search) || x.EmpresaBusca.Contains(search));
        }
        if (!string.IsNullOrEmpty(request.Status))
        {
            var status = Enum.Parse<StatusRecrutador>(request.Status);
            query = query.Where(x => x.Status == status);
        }
        var total = await query.CountAsync();
        var items = await query.OrderBy(x => x.User.NomeBusca).ThenBy(x => x.UserId)
            .Skip((request.Page - 1) * 10).Take(10)
            .Select(x => new RecrutadorListItem(x.UserId, x.User.NomeCompleto, x.Empresa, x.Cargo,
                x.Cidade, x.Uf, x.Status, x.User.UltimoLoginEm)).ToListAsync();
        return new(items, request.Page, 10, total, (int)Math.Ceiling(total / 10d));
    }

    public Task<RecrutadorDetailResponse?> GetAsync(Guid id) => database.Recrutadores.AsNoTracking()
        .Where(x => x.UserId == id)
        .Select(x => new RecrutadorDetailResponse(x.UserId, x.User.NomeCompleto, x.User.Email!, x.Empresa,
            x.Cargo, x.Telefone, x.Cidade, x.Uf, x.Status, x.User.UltimoLoginEm)).SingleOrDefaultAsync();

    public async Task<bool> SetActiveAsync(Guid id, bool active)
    {
        await using var transaction = await database.Database.BeginTransactionAsync();
        var recruiter = await database.Recrutadores.Include(x => x.User).SingleOrDefaultAsync(x => x.UserId == id);
        if (recruiter is null) return false;
        var status = active ? StatusRecrutador.ATIVO : StatusRecrutador.BLOQUEADO;
        if (recruiter.Status == status) return true;
        recruiter.Status = status;
        await audit.RecordAsync(active ? AcaoAuditoria.RECRUTADOR_REATIVADO : AcaoAuditoria.RECRUTADOR_BLOQUEADO,
            AppRoles.Recruiter, id, $"Recrutador {recruiter.User.NomeCompleto} {(active ? "reativado" : "bloqueado")}.");
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return true;
    }
}
