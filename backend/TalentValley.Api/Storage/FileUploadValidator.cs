using Microsoft.AspNetCore.Http;

namespace TalentValley.Api.Storage;

public enum UploadKind { Photo, Pdf }

public sealed record ValidatedUpload(IFormFile File, string Extension, string ContentType);

public sealed class UploadValidationException(string message) : Exception(message);

public sealed class FileUploadValidator
{
    public const long PhotoMaximumBytes = 5L * 1024 * 1024;
    public const long PdfMaximumBytes = 10L * 1024 * 1024;

    public async Task<ValidatedUpload> ValidateAsync(IFormFile? file, UploadKind kind,
        CancellationToken cancellationToken = default)
    {
        if (file is null || file.Length == 0)
            throw new UploadValidationException("The uploaded file must not be empty.");

        var maximum = kind == UploadKind.Photo ? PhotoMaximumBytes : PdfMaximumBytes;
        if (file.Length > maximum)
            throw new UploadValidationException($"The uploaded file exceeds the {maximum / 1024 / 1024} MB limit.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var expectedContentType = kind == UploadKind.Pdf
            ? extension == ".pdf" ? "application/pdf" : null
            : extension switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".webp" => "image/webp",
                _ => null
            };
        if (expectedContentType is null)
            throw new UploadValidationException("The file extension is not supported.");
        if (!string.Equals(file.ContentType, expectedContentType, StringComparison.OrdinalIgnoreCase))
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

        var validSignature = kind == UploadKind.Pdf
            ? read >= 5 && header.AsSpan(0, 5).SequenceEqual("%PDF-"u8)
            : expectedContentType switch
            {
                "image/jpeg" => read >= 3 && header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff,
                "image/png" => read >= 8 && header.AsSpan(0, 8).SequenceEqual(new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a }),
                "image/webp" => read >= 12 && header.AsSpan(0, 4).SequenceEqual("RIFF"u8) && header.AsSpan(8, 4).SequenceEqual("WEBP"u8),
                _ => false
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
