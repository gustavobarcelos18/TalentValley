using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;

namespace TalentValley.Api.Storage;

public sealed partial class LocalFileStorage : IFileStorage
{
    private readonly string rootPath;

    public LocalFileStorage(IOptions<StorageOptions> options, IWebHostEnvironment environment)
    {
        var configured = options.Value.RootPath;
        if (string.IsNullOrWhiteSpace(configured))
            throw new InvalidOperationException("Storage:RootPath must be configured.");

        rootPath = Path.GetFullPath(Path.IsPathRooted(configured)
            ? configured
            : Path.Combine(environment.ContentRootPath, configured));
    }

    public async Task<string> StoreAsync(FileCategory category, Stream content, string extension,
        CancellationToken cancellationToken = default)
    {
        extension = NormalizeExtension(category, extension);
        var directory = CategoryDirectory(category);
        Directory.CreateDirectory(directory);

        var key = $"{Guid.NewGuid():N}{extension}";
        var path = ResolvePath(category, key);
        try
        {
            await using var destination = new FileStream(path, FileMode.CreateNew, FileAccess.Write,
                FileShare.None, 81920, FileOptions.Asynchronous);
            await content.CopyToAsync(destination, cancellationToken);
            return key;
        }
        catch
        {
            if (File.Exists(path)) File.Delete(path);
            throw;
        }
    }

    public Task<Stream?> OpenReadAsync(FileCategory category, string storageKey,
        CancellationToken cancellationToken = default)
    {
        var path = ResolvePath(category, storageKey);
        Stream? stream = File.Exists(path)
            ? new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 81920,
                FileOptions.Asynchronous | FileOptions.SequentialScan)
            : null;
        return Task.FromResult(stream);
    }

    public Task<bool> ExistsAsync(FileCategory category, string storageKey,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(File.Exists(ResolvePath(category, storageKey)));

    public Task DeleteAsync(FileCategory category, string storageKey,
        CancellationToken cancellationToken = default)
    {
        var path = ResolvePath(category, storageKey);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    private string ResolvePath(FileCategory category, string storageKey)
    {
        if (!StorageKeyPattern().IsMatch(storageKey))
            throw new ArgumentException("Invalid storage key.", nameof(storageKey));

        var directory = CategoryDirectory(category);
        var path = Path.GetFullPath(Path.Combine(directory, storageKey));
        if (!path.StartsWith(directory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new ArgumentException("Invalid storage key.", nameof(storageKey));
        return path;
    }

    private string CategoryDirectory(FileCategory category) => Path.Combine(rootPath, category switch
    {
        FileCategory.Photo => "fotos",
        FileCategory.Curriculum => "curriculos",
        FileCategory.Certificate => "certificados",
        _ => throw new ArgumentOutOfRangeException(nameof(category))
    });

    private static string NormalizeExtension(FileCategory category, string extension)
    {
        var normalized = extension.StartsWith('.') ? extension.ToLowerInvariant() : $".{extension.ToLowerInvariant()}";
        var allowed = category == FileCategory.Photo
            ? normalized is ".jpg" or ".png" or ".webp"
            : normalized == ".pdf";
        return allowed ? normalized : throw new ArgumentException("Invalid extension.", nameof(extension));
    }

    [GeneratedRegex("^[a-f0-9]{32}\\.(jpg|png|webp|pdf)$", RegexOptions.CultureInvariant)]
    private static partial Regex StorageKeyPattern();
}
