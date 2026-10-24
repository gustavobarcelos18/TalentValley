using Microsoft.AspNetCore.Http;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Tests;

public sealed class FileUploadValidatorZipTests
{
    private static readonly byte[] ZipHeader = [0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0];

    private static FormFile CreateFile(byte[] content, string fileName, string contentType, long? length = null) =>
        new(new MemoryStream(content), 0, length ?? content.Length, "file", fileName)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };

    [Theory]
    [InlineData("application/zip")]
    [InlineData("application/x-zip-compressed")]
    public async Task Valid_zip_is_accepted(string contentType)
    {
        var upload = await new FileUploadValidator().ValidateAsync(CreateFile(ZipHeader, "Dados.ZIP", contentType), UploadKind.Zip);

        Assert.Equal(".zip", upload.Extension);
        Assert.Equal("application/zip", upload.ContentType);
    }

    [Fact]
    public async Task Zip_with_invalid_signature_is_rejected()
    {
        var pdfDisguisedAsZip = CreateFile("%PDF-1.7 not a zip"u8.ToArray(), "dados.zip", "application/zip");

        var error = await Assert.ThrowsAsync<UploadValidationException>(
            () => new FileUploadValidator().ValidateAsync(pdfDisguisedAsZip, UploadKind.Zip));

        Assert.Equal("The file signature is invalid.", error.Message);
    }

    [Fact]
    public async Task Zip_with_wrong_extension_or_content_type_is_rejected()
    {
        var validator = new FileUploadValidator();

        await Assert.ThrowsAsync<UploadValidationException>(
            () => validator.ValidateAsync(CreateFile(ZipHeader, "dados.rar", "application/zip"), UploadKind.Zip));
        await Assert.ThrowsAsync<UploadValidationException>(
            () => validator.ValidateAsync(CreateFile(ZipHeader, "dados.zip", "text/plain"), UploadKind.Zip));
    }

    [Fact]
    public async Task Zip_larger_than_the_limit_or_empty_is_rejected()
    {
        var validator = new FileUploadValidator();
        var tooBig = CreateFile(ZipHeader, "dados.zip", "application/zip", FileUploadValidator.ZipMaximumBytes + 1);

        await Assert.ThrowsAsync<UploadValidationException>(() => validator.ValidateAsync(tooBig, UploadKind.Zip));
        await Assert.ThrowsAsync<UploadValidationException>(() => validator.ValidateAsync(null, UploadKind.Zip));
        await Assert.ThrowsAsync<UploadValidationException>(
            () => validator.ValidateAsync(CreateFile([], "dados.zip", "application/zip"), UploadKind.Zip));
    }

    [Theory]
    [InlineData("a.pdf", "application/pdf", UploadKind.Pdf, new byte[] { 0x25, 0x50, 0x44, 0x46, 0x2d, 0x31 })]
    [InlineData("a.jpeg", "image/jpeg", UploadKind.Photo, new byte[] { 0xff, 0xd8, 0xff, 0xe0 })]
    [InlineData("a.png", "image/png", UploadKind.Photo, new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a })]
    [InlineData("a.webp", "image/webp", UploadKind.Photo, new byte[] { 0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50 })]
    public async Task Pdf_and_photo_validation_is_unchanged(string fileName, string contentType, UploadKind kind, byte[] content)
    {
        var upload = await new FileUploadValidator().ValidateAsync(CreateFile(content, fileName, contentType), kind);

        Assert.Equal(contentType, upload.ContentType);
    }

    [Fact]
    public async Task Zip_is_not_accepted_where_a_pdf_or_photo_is_expected()
    {
        var validator = new FileUploadValidator();

        await Assert.ThrowsAsync<UploadValidationException>(
            () => validator.ValidateAsync(CreateFile(ZipHeader, "dados.zip", "application/zip"), UploadKind.Pdf));
        await Assert.ThrowsAsync<UploadValidationException>(
            () => validator.ValidateAsync(CreateFile(ZipHeader, "dados.zip", "application/zip"), UploadKind.Photo));
    }
}
