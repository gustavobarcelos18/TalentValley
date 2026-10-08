using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Services;

public enum RecrutadorSelfDeleteResult { Deleted, NotFound, InvalidPassword, LockedOut }

// Shared by admin deletion and recruiter self-deletion (LGPD). The caller owns the transaction:
// load with LoadAsync, apply its own guards, RemoveAsync, commit. Recruiters own no stored files.
public sealed class RecrutadorDeletionService(AppDbContext database, SignInManager<ApplicationUser> signIn,
    AuditoriaService audit)
{
    public Task<Recrutador?> LoadAsync(Guid id, CancellationToken cancellationToken = default) =>
        database.Recrutadores.Include(x => x.User).SingleOrDefaultAsync(x => x.UserId == id, cancellationToken);

    public async Task RemoveAsync(Recrutador recrutador, bool selfDeletion, CancellationToken cancellationToken = default)
    {
        var user = recrutador.User;
        if (selfDeletion)
            audit.RecordSelfService(AcaoAuditoria.RECRUTADOR_EXCLUIDO_PROPRIO, AuditoriaService.RecruiterSelfServiceActor,
                AppRoles.Recruiter, recrutador.UserId, "Recrutador excluiu a própria conta.");
        else
            await audit.RecordAsync(AcaoAuditoria.RECRUTADOR_EXCLUIDO, AppRoles.Recruiter, recrutador.UserId,
                $"Recrutador {user.NomeCompleto} excluído.");

        // Registration requests hold the same personal data, so they are removed with the account.
        if (user.Email is not null)
        {
            var normalizedEmail = user.Email.ToUpperInvariant();
            database.SolicitacoesCadastro.RemoveRange(await database.SolicitacoesCadastro
                .Where(x => x.EmailNormalizado == normalizedEmail).ToListAsync(cancellationToken));
        }

        // Remove the profile first: favorites cascade, while its Identity FK is Restrict.
        database.Recrutadores.Remove(recrutador);
        await database.SaveChangesAsync(cancellationToken);
        AdminAccountService.RequireSuccess(await signIn.UserManager.DeleteAsync(user));
    }

    // LGPD self-deletion: the recruiter confirms with the current password; failures count toward lockout.
    public async Task<RecrutadorSelfDeleteResult> DeleteOwnAsync(Guid userId, string password,
        CancellationToken cancellationToken = default)
    {
        var user = await signIn.UserManager.FindByIdAsync(userId.ToString());
        if (user is null) return RecrutadorSelfDeleteResult.NotFound;
        var check = await signIn.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);
        if (check.IsLockedOut) return RecrutadorSelfDeleteResult.LockedOut;
        if (!check.Succeeded) return RecrutadorSelfDeleteResult.InvalidPassword;

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var recrutador = await LoadAsync(userId, cancellationToken);
        // Re-checked inside the transaction: an admin may have blocked the account after authorization.
        if (recrutador is null || recrutador.Status != StatusRecrutador.ATIVO) return RecrutadorSelfDeleteResult.NotFound;
        await RemoveAsync(recrutador, selfDeletion: true, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return RecrutadorSelfDeleteResult.Deleted;
    }
}
