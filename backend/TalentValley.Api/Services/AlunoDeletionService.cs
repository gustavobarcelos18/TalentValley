using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Services;

// Shared by admin deletion and student self-deletion (LGPD). The caller owns the transaction:
// load with LoadAsync, apply its own guards, RemoveAsync, commit, then DeleteFilesAsync.
public sealed class AlunoDeletionService(AppDbContext database, UserManager<ApplicationUser> users,
    AuditoriaService audit, IFileStorage storage, ILogger<AlunoDeletionService> logger)
{
    public Task<Aluno?> LoadAsync(Guid id, CancellationToken cancellationToken = default) =>
        database.Alunos.Include(x => x.User).Include(x => x.Formacoes)
            .SingleOrDefaultAsync(x => x.UserId == id, cancellationToken);

    public async Task<IReadOnlyList<StoredFile>> RemoveAsync(Aluno aluno, bool selfDeletion,
        CancellationToken cancellationToken = default)
    {
        var user = aluno.User;
        var files = new List<StoredFile>();
        if (aluno.FotoStorageKey is not null) files.Add(new(FileCategory.Photo, aluno.FotoStorageKey));
        if (aluno.CurriculoStorageKey is not null) files.Add(new(FileCategory.Curriculum, aluno.CurriculoStorageKey));
        files.AddRange(aluno.Formacoes.Where(x => x.CertificadoStorageKey is not null)
            .Select(x => new StoredFile(FileCategory.Certificate, x.CertificadoStorageKey!)));

        if (selfDeletion)
            audit.RecordSelfService(AcaoAuditoria.ALUNO_EXCLUIDO_PROPRIO, AuditoriaService.StudentSelfServiceActor,
                AppRoles.Student, aluno.UserId, "Aluno excluiu a própria conta.");
        else
            await audit.RecordAsync(AcaoAuditoria.ALUNO_EXCLUIDO, AppRoles.Student, aluno.UserId,
                $"Aluno {user.NomeCompleto} excluído.");

        // Registration requests hold the same personal data, so they are removed with the account.
        if (user.Email is not null)
        {
            var normalizedEmail = user.Email.ToUpperInvariant();
            database.SolicitacoesCadastro.RemoveRange(await database.SolicitacoesCadastro
                .Where(x => x.EmailNormalizado == normalizedEmail).ToListAsync(cancellationToken));
        }

        // Remove the profile first: owned rows/favorites cascade, while its Identity FK is Restrict.
        database.Alunos.Remove(aluno);
        await database.SaveChangesAsync(cancellationToken);
        AdminAccountService.RequireSuccess(await users.DeleteAsync(user));
        return files;
    }

    // Best effort after commit: a failed file removal must not resurrect the deleted account.
    public async Task DeleteFilesAsync(IReadOnlyList<StoredFile> files)
    {
        foreach (var file in files)
        {
            try { await storage.DeleteAsync(file.Category, file.Key); }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to clean {Category} file {StorageKey} after student deletion.",
                    file.Category, file.Key);
            }
        }
    }
}

public sealed record StoredFile(FileCategory Category, string Key);
