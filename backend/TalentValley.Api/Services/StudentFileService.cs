using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Services;

public sealed record ProtectedFile(Stream Content, string ContentType);
public enum FileMutationResult { NotFound, NoChange, Changed }

public sealed class StudentFileService(AppDbContext database, IFileStorage storage,
    FileUploadValidator validator, ILogger<StudentFileService> logger)
{
    public Task UploadPhotoAsync(Guid alunoId, IFormFile? file, CancellationToken cancellationToken) =>
        ReplaceAlunoFileAsync(alunoId, file, UploadKind.Photo, FileCategory.Photo, true, cancellationToken);

    public Task UploadCurriculumAsync(Guid alunoId, IFormFile? file, CancellationToken cancellationToken) =>
        ReplaceAlunoFileAsync(alunoId, file, UploadKind.Pdf, FileCategory.Curriculum, false, cancellationToken);

    public async Task<ProtectedFile?> OpenPhotoAsync(Guid alunoId, CancellationToken cancellationToken) =>
        await OpenAlunoFileAsync(alunoId, FileCategory.Photo, true, cancellationToken);

    public async Task<ProtectedFile?> OpenCurriculumAsync(Guid alunoId, CancellationToken cancellationToken) =>
        await OpenAlunoFileAsync(alunoId, FileCategory.Curriculum, false, cancellationToken);

    public Task<FileMutationResult> DeletePhotoAsync(Guid alunoId, CancellationToken cancellationToken) =>
        DeleteAlunoFileAsync(alunoId, FileCategory.Photo, true, cancellationToken);

    public Task<FileMutationResult> DeleteCurriculumAsync(Guid alunoId, CancellationToken cancellationToken) =>
        DeleteAlunoFileAsync(alunoId, FileCategory.Curriculum, false, cancellationToken);

    public async Task<FileMutationResult> UploadCertificateAsync(Guid alunoId, Guid formationId, IFormFile? file,
        CancellationToken cancellationToken)
    {
        var formation = await database.Formacoes.Include(x => x.Aluno)
            .SingleOrDefaultAsync(x => x.Id == formationId && x.AlunoId == alunoId, cancellationToken);
        if (formation is null) return FileMutationResult.NotFound;
        var upload = await validator.ValidateAsync(file, UploadKind.Pdf, cancellationToken);

        await using var content = upload.File.OpenReadStream();
        var newKey = await storage.StoreAsync(FileCategory.Certificate, content, upload.Extension, cancellationToken);
        var oldKey = formation.CertificadoStorageKey;
        var oldFormationTimestamp = formation.AtualizadoEm;
        var oldStudentTimestamp = formation.Aluno.AtualizadoEm;
        var oldStatus = formation.StatusValidacaoRpv;
        var oldValidatedAt = formation.ValidadoEm;
        var now = DateTimeOffset.UtcNow;
        formation.CertificadoStorageKey = newKey;
        formation.AtualizadoEm = now;
        formation.Aluno.AtualizadoEm = now;
        if (formation.EhRioPombaValley)
        {
            formation.StatusValidacaoRpv = StatusValidacaoRpv.PENDENTE;
            formation.ValidadoEm = null;
        }
        else
        {
            formation.StatusValidacaoRpv = null;
            formation.ValidadoEm = null;
        }

        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            formation.CertificadoStorageKey = oldKey;
            formation.AtualizadoEm = oldFormationTimestamp;
            formation.Aluno.AtualizadoEm = oldStudentTimestamp;
            formation.StatusValidacaoRpv = oldStatus;
            formation.ValidadoEm = oldValidatedAt;
            await TryDeleteNewAsync(FileCategory.Certificate, newKey);
            throw;
        }

        if (oldKey is not null) await TryCleanupAsync(FileCategory.Certificate, oldKey);
        return FileMutationResult.Changed;
    }

    public async Task<ProtectedFile?> OpenCertificateAsync(Guid alunoId, Guid formationId,
        CancellationToken cancellationToken)
    {
        var key = await database.Formacoes.AsNoTracking()
            .Where(x => x.Id == formationId && x.AlunoId == alunoId)
            .Select(x => x.CertificadoStorageKey)
            .SingleOrDefaultAsync(cancellationToken);
        if (key is null) return null;
        var content = await storage.OpenReadAsync(FileCategory.Certificate, key, cancellationToken);
        return content is null ? null : new(content, FileUploadValidator.ContentTypeFromKey(key));
    }

    public async Task<FileMutationResult> DeleteCertificateAsync(Guid alunoId, Guid formationId,
        CancellationToken cancellationToken)
    {
        var formation = await database.Formacoes.Include(x => x.Aluno)
            .SingleOrDefaultAsync(x => x.Id == formationId && x.AlunoId == alunoId, cancellationToken);
        if (formation is null) return FileMutationResult.NotFound;
        var oldKey = formation.CertificadoStorageKey;
        if (oldKey is null) return FileMutationResult.NoChange;

        var now = DateTimeOffset.UtcNow;
        formation.CertificadoStorageKey = null;
        formation.AtualizadoEm = now;
        formation.Aluno.AtualizadoEm = now;
        if (formation.EhRioPombaValley)
        {
            formation.StatusValidacaoRpv = StatusValidacaoRpv.PENDENTE;
            formation.ValidadoEm = null;
        }
        else
        {
            formation.StatusValidacaoRpv = null;
            formation.ValidadoEm = null;
        }
        await database.SaveChangesAsync(cancellationToken);
        await TryCleanupAsync(FileCategory.Certificate, oldKey);
        return FileMutationResult.Changed;
    }

    private async Task ReplaceAlunoFileAsync(Guid alunoId, IFormFile? file, UploadKind kind,
        FileCategory category, bool photo, CancellationToken cancellationToken)
    {
        var upload = await validator.ValidateAsync(file, kind, cancellationToken);
        var aluno = await database.Alunos.SingleOrDefaultAsync(x => x.UserId == alunoId, cancellationToken)
            ?? throw new AlunoProfileNotFoundException();
        await using var content = upload.File.OpenReadStream();
        var newKey = await storage.StoreAsync(category, content, upload.Extension, cancellationToken);
        var oldKey = photo ? aluno.FotoStorageKey : aluno.CurriculoStorageKey;
        var oldTimestamp = aluno.AtualizadoEm;
        if (photo) aluno.FotoStorageKey = newKey;
        else aluno.CurriculoStorageKey = newKey;
        aluno.AtualizadoEm = DateTimeOffset.UtcNow;

        try
        {
            await database.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            if (photo) aluno.FotoStorageKey = oldKey;
            else aluno.CurriculoStorageKey = oldKey;
            aluno.AtualizadoEm = oldTimestamp;
            await TryDeleteNewAsync(category, newKey);
            throw;
        }

        if (oldKey is not null) await TryCleanupAsync(category, oldKey);
    }

    private async Task<ProtectedFile?> OpenAlunoFileAsync(Guid alunoId, FileCategory category, bool photo,
        CancellationToken cancellationToken)
    {
        var aluno = await database.Alunos.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == alunoId, cancellationToken);
        if (aluno is null) throw new AlunoProfileNotFoundException();
        var key = photo ? aluno.FotoStorageKey : aluno.CurriculoStorageKey;
        if (key is null) return null;
        var content = await storage.OpenReadAsync(category, key, cancellationToken);
        return content is null ? null : new(content, FileUploadValidator.ContentTypeFromKey(key));
    }

    private async Task<FileMutationResult> DeleteAlunoFileAsync(Guid alunoId, FileCategory category, bool photo,
        CancellationToken cancellationToken)
    {
        var aluno = await database.Alunos.SingleOrDefaultAsync(x => x.UserId == alunoId, cancellationToken)
            ?? throw new AlunoProfileNotFoundException();
        var oldKey = photo ? aluno.FotoStorageKey : aluno.CurriculoStorageKey;
        if (oldKey is null) return FileMutationResult.NoChange;
        if (photo) aluno.FotoStorageKey = null;
        else aluno.CurriculoStorageKey = null;
        aluno.AtualizadoEm = DateTimeOffset.UtcNow;
        await database.SaveChangesAsync(cancellationToken);
        await TryCleanupAsync(category, oldKey);
        return FileMutationResult.Changed;
    }

    private async Task TryDeleteNewAsync(FileCategory category, string key)
    {
        try { await storage.DeleteAsync(category, key); }
        catch (Exception ex) { logger.LogError(ex, "Failed to clean newly stored {Category} file {StorageKey}.", category, key); }
    }

    private async Task TryCleanupAsync(FileCategory category, string key)
    {
        try { await storage.DeleteAsync(category, key); }
        catch (Exception ex) { logger.LogError(ex, "Failed to clean obsolete {Category} file {StorageKey}.", category, key); }
    }
}
