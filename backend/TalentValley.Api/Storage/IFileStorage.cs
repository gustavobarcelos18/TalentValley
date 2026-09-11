namespace TalentValley.Api.Storage;

public interface IFileStorage
{
    Task<string> StoreAsync(FileCategory category, Stream content, string extension,
        CancellationToken cancellationToken = default);
    Task<Stream?> OpenReadAsync(FileCategory category, string storageKey,
        CancellationToken cancellationToken = default);
    Task<bool> ExistsAsync(FileCategory category, string storageKey,
        CancellationToken cancellationToken = default);
    Task DeleteAsync(FileCategory category, string storageKey,
        CancellationToken cancellationToken = default);
}
