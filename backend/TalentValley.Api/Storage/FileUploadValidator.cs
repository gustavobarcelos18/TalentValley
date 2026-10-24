using Microsoft.AspNetCore.Http;

namespace TalentValley.Api.Storage;

public enum UploadKind { Photo, Pdf, Zip }

public sealed record ValidatedUpload(IFormFile File, string Extension, string ContentType);

public sealed class UploadValidationException(string message) : Exception(message);

public sealed class FileUploadValidator
{
    public const long PhotoMaximumBytes = 5L * 1024 * 1024;
    public const long PdfMaximumBytes = 10L * 1024 * 1024;
    public const long ZipMaximumBytes = 20L * 1024 * 1024;

    // Windows browsers often label ZIP files with this older content type.
    private const string WindowsZipContentType = "application/x-zip-compressed";

    public async Task<ValidatedUpload> ValidateAsync(IFormFile? file, UploadKind kind,
        CancellationToken cancellationToken = default)
    {
        if (file is null || file.Length == 0)
            throw new UploadValidationException("The uploaded file must not be empty.");

        var maximum = kind switch
        {
            UploadKind.Photo => PhotoMaximumBytes,
            UploadKind.Pdf => PdfMaximumBytes,
            _ => ZipMaximumBytes
        };
        if (file.Length > maximum)
            throw new UploadValidationException($"The uploaded file exceeds the {maximum / 1024 / 1024} MB limit.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var expectedContentType = kind switch
        {
            UploadKind.Pdf => extension == ".pdf" ? "application/pdf" : null,
            UploadKind.Zip => extension == ".zip" ? "application/zip" : null,
            _ => extension switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".webp" => "image/webp",
                _ => null
            }
        };
        if (expectedContentType is null)
            throw new UploadValidationException("The file extension is not supported.");
        var contentTypeMatches = string.Equals(file.ContentType, expectedContentType, StringComparison.OrdinalIgnoreCase)
            || (kind == UploadKind.Zip && string.Equals(file.ContentType, WindowsZipContentType, StringComparison.OrdinalIgnoreCase));
        if (!contentTypeMatches)
            throw new UploadValidationException("The declared content type does not match the file extension.");

        var header = new byte[12];
        await using var stream = file.OpenReadStream();
        var read = 0;
        while (read < header.Length)
        {
            var count = await stream.ReadAsync(header.AsMemory(read, header.Length - read), cancellationToken);
            if (count == 0) break;
            read += count;
        }

        var validSignature = kind switch
        {
            UploadKind.Pdf => read >= 5 && header.AsSpan(0, 5).SequenceEqual("%PDF-"u8),
            UploadKind.Zip => read >= 4 && header.AsSpan(0, 4).SequenceEqual(new byte[] { 0x50, 0x4b, 0x03, 0x04 }),
            _ => expectedContentType switch
            {
                "image/jpeg" => read >= 3 && header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff,
                "image/png" => read >= 8 && header.AsSpan(0, 8).SequenceEqual(new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a }),
                "image/webp" => read >= 12 && header.AsSpan(0, 4).SequenceEqual("RIFF"u8) && header.AsSpan(8, 4).SequenceEqual("WEBP"u8),
                _ => false
            }
        };
        if (!validSignature)
            throw new UploadValidationException("The file signature is invalid.");

        return new(file, extension == ".jpeg" ? ".jpg" : extension, expectedContentType);
    }

    public static string ContentTypeFromKey(string storageKey) => Path.GetExtension(storageKey).ToLowerInvariant() switch
    {
        ".jpg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        ".pdf" => "application/pdf",
        _ => throw new InvalidOperationException("Stored file type is invalid.")
    };
}
