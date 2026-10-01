using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Services;

public sealed class TalentFileService(AppDbContext database, IFileStorage storage)
{
    public async Task<ProtectedFile?> OpenPhotoAsync(string slug, CancellationToken cancellationToken)
    {
        var key = await database.Alunos.AsNoTracking().VisibleToRecruiters().Where(x => x.Slug == slug)
            .Select(x => x.FotoStorageKey).SingleOrDefaultAsync(cancellationToken);
        return await OpenAsync(FileCategory.Photo, key, cancellationToken);
    }

    public async Task<ProtectedFile?> OpenCurriculumAsync(string slug, CancellationToken cancellationToken)
    {
        var key = await database.Alunos.AsNoTracking().VisibleToRecruiters().Where(x => x.Slug == slug)
            .Select(x => x.CurriculoStorageKey).SingleOrDefaultAsync(cancellationToken);
        return await OpenAsync(FileCategory.Curriculum, key, cancellationToken);
    }

    public async Task<ProtectedFile?> OpenCertificateAsync(
        string slug, Guid formationId, CancellationToken cancellationToken)
    {
        var key = await database.Alunos.AsNoTracking().VisibleToRecruiters().Where(x => x.Slug == slug)
            .SelectMany(x => x.Formacoes).Where(x => x.Id == formationId)
            .Select(x => x.CertificadoStorageKey).SingleOrDefaultAsync(cancellationToken);
        return await OpenAsync(FileCategory.Certificate, key, cancellationToken);
    }

    private async Task<ProtectedFile?> OpenAsync(
        FileCategory category, string? key, CancellationToken cancellationToken)
    {
        if (key is null) return null;
        var content = await storage.OpenReadAsync(category, key, cancellationToken);
        return content is null ? null : new(content, FileUploadValidator.ContentTypeFromKey(key));
    }
}
