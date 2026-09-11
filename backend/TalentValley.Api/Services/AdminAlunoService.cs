using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Services;

public sealed class AdminAlunoService(AppDbContext database, AdminAccountService accounts,
    UserManager<ApplicationUser> users, SlugService slugs, AuditoriaService audit,
    IFileStorage storage, ILogger<AdminAlunoService> logger)
{
    public async Task<AlunoCreatedResponse> CreateAsync(CreateAlunoRequest request)
    {
        await accounts.EnsureEmailAvailableAsync(request.Email);
        ApplicationUser user;
        // SQLite's non-deferred write transaction serializes slug allocation and account writes.
        await using (var transaction = await database.Database.BeginTransactionAsync())
        {
            user = await accounts.CreateAsync(request.NomeCompleto, request.Email, AppRoles.Student);
            database.Alunos.Add(new Aluno
            {
                UserId = user.Id, Slug = await slugs.GenerateAsync(user.NomeCompleto),
                Ativo = true, AtualizadoEm = DateTimeOffset.UtcNow
            });
            await audit.RecordAsync(AcaoAuditoria.ALUNO_CRIADO, AppRoles.Student, user.Id,
                $"Acesso do aluno {user.NomeCompleto} criado.");
            await database.SaveChangesAsync();
            await transaction.CommitAsync();
        }
        await accounts.TrySendActivationAsync(user);
        return new(user.Id, user.NomeCompleto, user.Email!, true);
    }

    public async Task<PaginatedResponse<AlunoListItem>> ListAsync(AdminListQuery request)
    {
        var query = database.Alunos.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var search = NameNormalizer.Normalize(request.Search);
            query = query.Where(x => x.User.NomeBusca.Contains(search));
        }
        var total = await query.CountAsync();
        var items = await query.OrderBy(x => x.User.NomeBusca).ThenBy(x => x.UserId)
            .Skip((request.Page - 1) * 10).Take(10)
            // Photo delivery belongs to the storage phase; never expose a storage key as a URL.
            .Select(x => new AlunoListItem(x.UserId, x.Slug, x.User.NomeCompleto, null,
                x.Cidade, x.Uf, x.Ativo, x.AtualizadoEm)).ToListAsync();
        return new(items, request.Page, 10, total, (int)Math.Ceiling(total / 10d));
    }

    public async Task<bool> SetActiveAsync(Guid id, bool active)
    {
        await using var transaction = await database.Database.BeginTransactionAsync();
        var aluno = await database.Alunos.Include(x => x.User).SingleOrDefaultAsync(x => x.UserId == id);
        if (aluno is null) return false;
        if (aluno.Ativo == active) return true;
        aluno.Ativo = active;
        await audit.RecordAsync(active ? AcaoAuditoria.ALUNO_REATIVADO : AcaoAuditoria.ALUNO_BLOQUEADO,
            AppRoles.Student, id, $"Aluno {aluno.User.NomeCompleto} {(active ? "reativado" : "bloqueado")}.");
        await database.SaveChangesAsync();
        await transaction.CommitAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        await using var transaction = await database.Database.BeginTransactionAsync();
        var aluno = await database.Alunos.Include(x => x.User).Include(x => x.Formacoes)
            .SingleOrDefaultAsync(x => x.UserId == id);
        if (aluno is null) return false;
        var user = aluno.User;
        var files = new List<(FileCategory Category, string Key)>();
        if (aluno.FotoStorageKey is not null) files.Add((FileCategory.Photo, aluno.FotoStorageKey));
        if (aluno.CurriculoStorageKey is not null) files.Add((FileCategory.Curriculum, aluno.CurriculoStorageKey));
        files.AddRange(aluno.Formacoes.Where(x => x.CertificadoStorageKey is not null)
            .Select(x => (FileCategory.Certificate, x.CertificadoStorageKey!)));
        await audit.RecordAsync(AcaoAuditoria.ALUNO_EXCLUIDO, AppRoles.Student, id,
            $"Aluno {user.NomeCompleto} excluído.");
        // Remove the profile first: owned rows/favorites cascade, while its Identity FK is Restrict.
        database.Alunos.Remove(aluno);
        await database.SaveChangesAsync();
        AdminAccountService.RequireSuccess(await users.DeleteAsync(user));
        await transaction.CommitAsync();
        foreach (var file in files)
        {
            try { await storage.DeleteAsync(file.Category, file.Key); }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to clean {Category} file {StorageKey} after student deletion.",
                    file.Category, file.Key);
            }
        }
        return true;
    }
}
