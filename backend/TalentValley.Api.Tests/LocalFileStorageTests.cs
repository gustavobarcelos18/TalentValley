using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Options;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Tests;

public sealed class LocalFileStorageTests : IDisposable
{
    private readonly string directory = Path.Combine(Path.GetTempPath(), "TalentValley.Storage.Tests", Guid.NewGuid().ToString("N"));
    private readonly LocalFileStorage storage;

    public LocalFileStorageTests()
    {
        Directory.CreateDirectory(directory);
        storage = new LocalFileStorage(Options.Create(new StorageOptions { RootPath = "uploads" }),
            new TestEnvironment(directory));
    }

    [Fact]
    public async Task Store_read_delete_uses_unique_opaque_keys_and_category_isolation()
    {
        var bytes = "%PDF-test"u8.ToArray();
        var first = await storage.StoreAsync(FileCategory.Curriculum, new MemoryStream(bytes), ".pdf");
        var second = await storage.StoreAsync(FileCategory.Curriculum, new MemoryStream(bytes), ".pdf");

        Assert.NotEqual(first, second);
        Assert.Matches("^[a-f0-9]{32}\\.pdf$", first);
        Assert.DoesNotContain("resume", first, StringComparison.OrdinalIgnoreCase);
        Assert.True(await storage.ExistsAsync(FileCategory.Curriculum, first));
        Assert.False(await storage.ExistsAsync(FileCategory.Certificate, first));
        await using (var read = await storage.OpenReadAsync(FileCategory.Curriculum, first))
        {
            Assert.NotNull(read);
            using var copy = new MemoryStream();
            await read.CopyToAsync(copy);
            Assert.Equal(bytes, copy.ToArray());
        }

        await storage.DeleteAsync(FileCategory.Curriculum, first);
        await storage.DeleteAsync(FileCategory.Curriculum, first);
        Assert.False(await storage.ExistsAsync(FileCategory.Curriculum, first));
    }

    [Fact]
    public async Task Storage_rejects_path_traversal_and_invalid_extensions()
    {
        await Assert.ThrowsAsync<ArgumentException>(() => storage.OpenReadAsync(FileCategory.Photo, "../secret.jpg"));
        await Assert.ThrowsAsync<ArgumentException>(() => storage.DeleteAsync(FileCategory.Photo, "C:\\secret.jpg"));
        await Assert.ThrowsAsync<ArgumentException>(() => storage.StoreAsync(FileCategory.Certificate,
            new MemoryStream([1]), ".jpg"));
        Assert.Empty(Directory.GetFiles(directory, "*", SearchOption.AllDirectories));
    }

    public void Dispose()
    {
        if (Directory.Exists(directory)) Directory.Delete(directory, true);
    }

    private sealed class TestEnvironment(string contentRoot) : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "Tests";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = Path.Combine(contentRoot, "wwwroot");
        public string EnvironmentName { get; set; } = "Development";
        public string ContentRootPath { get; set; } = contentRoot;
        public IFileProvider ContentRootFileProvider { get; set; } = new PhysicalFileProvider(contentRoot);
    }
}
