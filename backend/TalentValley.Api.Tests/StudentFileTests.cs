using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Tests;

public sealed class StudentFileTests
{
    private static readonly byte[] Jpeg = [0xff, 0xd8, 0xff, 0xe0, 1];
    private static readonly byte[] Png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1];
    private static readonly byte[] Webp = [0x52, 0x49, 0x46, 0x46, 1, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1];
    private static readonly byte[] Pdf = "%PDF-1.7 test"u8.ToArray();

    [Theory]
    [MemberData(nameof(PhotoCases))]
    public async Task Photo_upload_read_profile_and_delete_work(string name, string mime, byte[] bytes)
    {
        using var factory = new ApiFactory();
        var id = await factory.CreateUserAsync($"{Guid.NewGuid():N}@example.test");
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, await EmailAsync(factory, id));
        await ApiFactory.SetCsrfAsync(client);
        var before = await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions);
        Assert.Null(before!.DadosBasicos.FotoUrl);

        Assert.Equal(HttpStatusCode.NoContent, (await UploadAsync(client, "/api/alunos/me/foto", name, mime, bytes)).StatusCode);
        string oldKey = "";
        await factory.InScopeAsync(async p => oldKey =
            (await p.GetRequiredService<AppDbContext>().Alunos.SingleAsync(x => x.UserId == id)).FotoStorageKey!);
        var replacement = bytes.Concat(new byte[] { 2 }).ToArray();
        Assert.Equal(HttpStatusCode.NoContent,
            (await UploadAsync(client, "/api/alunos/me/foto", name, mime, replacement)).StatusCode);
        Assert.False(File.Exists(Path.Combine(factory.StoragePath, "fotos", oldKey)));
        var read = await client.GetAsync("/api/alunos/me/foto");
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        Assert.Equal(mime, read.Content.Headers.ContentType!.MediaType);
        Assert.Equal(replacement, await read.Content.ReadAsByteArrayAsync());
        var after = await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions);
        Assert.Equal("/api/alunos/me/foto", after!.DadosBasicos.FotoUrl);
        Assert.True(after.AtualizadoEm > before.AtualizadoEm);
        Assert.DoesNotContain("storageKey", await (await client.GetAsync("/api/alunos/me")).Content.ReadAsStringAsync(), StringComparison.OrdinalIgnoreCase);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/alunos/me/foto")).StatusCode);
        var timestamp = (await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!.AtualizadoEm;
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/alunos/me/foto")).StatusCode);
        Assert.Equal(timestamp, (await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!.AtualizadoEm);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/alunos/me/foto")).StatusCode);
    }

    public static TheoryData<string, string, byte[]> PhotoCases => new()
    {
        { "photo.jpg", "image/jpeg", Jpeg }, { "photo.png", "image/png", Png }, { "photo.webp", "image/webp", Webp }
    };

    [Theory]
    [MemberData(nameof(InvalidCases))]
    public async Task Invalid_uploads_are_rejected_without_writes(string endpoint, string name, string mime, byte[] bytes)
    {
        using var factory = new ApiFactory();
        var email = $"{Guid.NewGuid():N}@example.test";
        var id = await factory.CreateUserAsync(email);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        DateTimeOffset before = default;
        await factory.InScopeAsync(async p => before = (await p.GetRequiredService<AppDbContext>().Alunos.SingleAsync(x => x.UserId == id)).AtualizadoEm);

        Assert.Equal(HttpStatusCode.BadRequest, (await UploadAsync(client, endpoint, name, mime, bytes)).StatusCode);
        Assert.Empty(Directory.Exists(factory.StoragePath)
            ? Directory.GetFiles(factory.StoragePath, "*", SearchOption.AllDirectories) : []);
        await factory.InScopeAsync(async p =>
        {
            var aluno = await p.GetRequiredService<AppDbContext>().Alunos.SingleAsync(x => x.UserId == id);
            Assert.Equal(before, aluno.AtualizadoEm);
            Assert.Null(aluno.FotoStorageKey);
            Assert.Null(aluno.CurriculoStorageKey);
        });
    }

    public static TheoryData<string, string, string, byte[]> InvalidCases => new()
    {
        { "/api/alunos/me/foto", "photo.jpg", "image/jpeg", [] },
        { "/api/alunos/me/foto", "photo.jpg", "image/jpeg", "fake"u8.ToArray() },
        { "/api/alunos/me/foto", "photo.jpg", "image/png", Jpeg },
        { "/api/alunos/me/foto", "photo.gif", "image/gif", Jpeg },
        { "/api/alunos/me/curriculo", "cv.pdf", "application/pdf", "fake"u8.ToArray() },
        { "/api/alunos/me/curriculo", "cv.pdf", "text/plain", Pdf }
    };

    [Fact]
    public async Task Oversized_photo_and_pdf_are_rejected()
    {
        using var factory = new ApiFactory();
        var email = $"{Guid.NewGuid():N}@example.test";
        await factory.CreateUserAsync(email);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        var photo = new byte[FileUploadValidator.PhotoMaximumBytes + 1];
        Jpeg.CopyTo(photo, 0);
        var pdf = new byte[FileUploadValidator.PdfMaximumBytes + 1];
        Pdf.CopyTo(pdf, 0);
        Assert.Equal(HttpStatusCode.BadRequest, (await UploadAsync(client, "/api/alunos/me/foto", "x.jpg", "image/jpeg", photo)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await UploadAsync(client, "/api/alunos/me/curriculo", "x.pdf", "application/pdf", pdf)).StatusCode);
    }

    [Fact]
    public async Task Curriculum_replacement_flags_download_and_cleanup_work_without_affecting_login_email()
    {
        using var factory = new ApiFactory();
        var email = $"{Guid.NewGuid():N}@example.test";
        var id = await factory.CreateUserAsync(email);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        Assert.False((await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!.Curriculo.PossuiCurriculo);
        await UploadAsync(client, "/api/alunos/me/curriculo", "resume.pdf", "application/pdf", Pdf);
        string oldKey = "";
        await factory.InScopeAsync(async p => oldKey = (await p.GetRequiredService<AppDbContext>().Alunos.SingleAsync(x => x.UserId == id)).CurriculoStorageKey!);
        var replacement = "%PDF-new"u8.ToArray();
        Assert.Equal(HttpStatusCode.NoContent, (await UploadAsync(client, "/api/alunos/me/curriculo", "other.pdf", "application/pdf", replacement)).StatusCode);
        Assert.False(File.Exists(Path.Combine(factory.StoragePath, "curriculos", oldKey)));
        var response = await client.GetAsync("/api/alunos/me/curriculo");
        Assert.Equal(replacement, await response.Content.ReadAsByteArrayAsync());
        Assert.Equal("application/pdf", response.Content.Headers.ContentType!.MediaType);
        Assert.Contains("curriculo.pdf", response.Content.Headers.ContentDisposition!.FileName!);
        var profileJson = await (await client.GetAsync("/api/alunos/me")).Content.ReadAsStringAsync();
        Assert.Contains("\"possuiCurriculo\":true", profileJson);
        Assert.DoesNotContain(oldKey, profileJson);
        Assert.Equal(email, (await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions)) is not null ?
            (await client.GetFromJsonAsync<UsuarioAutenticadoResponse>("/api/auth/me", ApiFactory.JsonOptions))!.Email : null);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/alunos/me/curriculo")).StatusCode);
        Assert.False((await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!.Curriculo.PossuiCurriculo);
    }

    [Theory]
    [InlineData(StatusValidacaoRpv.VERIFICADO)]
    [InlineData(StatusValidacaoRpv.REJEITADO)]
    public async Task Certificate_replacement_resets_rpv_and_delete_preserves_pending(StatusValidacaoRpv status)
    {
        using var factory = new ApiFactory();
        var email = $"{Guid.NewGuid():N}@example.test";
        var studentId = await factory.CreateUserAsync(email);
        var formationId = Guid.NewGuid();
        DateTimeOffset before = default;
        string oldKey = "";
        await factory.InScopeAsync(async p =>
        {
            var db = p.GetRequiredService<AppDbContext>();
            oldKey = await p.GetRequiredService<IFileStorage>().StoreAsync(FileCategory.Certificate,
                new MemoryStream("%PDF-old"u8.ToArray()), ".pdf");
            var aluno = await db.Alunos.SingleAsync(x => x.UserId == studentId);
            before = aluno.AtualizadoEm;
            db.Formacoes.Add(new Formacao { Id = formationId, AlunoId = studentId, Nome = "Course", NomeBusca = "course",
                Instituicao = "RPV", EhRioPombaValley = true, StatusValidacaoRpv = status,
                ValidadoEm = DateTimeOffset.UtcNow, CertificadoStorageKey = oldKey });
            await db.SaveChangesAsync();
        });
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        var url = $"/api/alunos/me/formacoes/{formationId}/certificado";
        Assert.Equal(HttpStatusCode.NoContent, (await UploadAsync(client, url, "proof.pdf", "application/pdf", Pdf)).StatusCode);
        Assert.False(File.Exists(Path.Combine(factory.StoragePath, "certificados", oldKey)));
        Assert.Equal(Pdf, await (await client.GetAsync(url)).Content.ReadAsByteArrayAsync());
        await factory.InScopeAsync(async p =>
        {
            var item = await p.GetRequiredService<AppDbContext>().Formacoes.Include(x => x.Aluno).SingleAsync(x => x.Id == formationId);
            Assert.Equal(StatusValidacaoRpv.PENDENTE, item.StatusValidacaoRpv);
            Assert.Null(item.ValidadoEm);
            Assert.True(item.Aluno.AtualizadoEm > before);
        });
        Assert.True((await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!.Formacoes.Single().PossuiCertificado);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(url)).StatusCode);
        await factory.InScopeAsync(async p =>
        {
            var item = await p.GetRequiredService<AppDbContext>().Formacoes.SingleAsync(x => x.Id == formationId);
            Assert.Equal(StatusValidacaoRpv.PENDENTE, item.StatusValidacaoRpv);
            Assert.Null(item.ValidadoEm);
            Assert.Null(item.CertificadoStorageKey);
        });
    }

    [Fact]
    public async Task Certificate_ownership_is_hidden_and_non_rpv_status_stays_null()
    {
        using var factory = new ApiFactory();
        var ownerEmail = $"{Guid.NewGuid():N}@example.test";
        var otherEmail = $"{Guid.NewGuid():N}@example.test";
        var ownerId = await factory.CreateUserAsync(ownerEmail);
        await factory.CreateUserAsync(otherEmail);
        var formationId = Guid.NewGuid();
        await factory.InScopeAsync(async p =>
        {
            var db = p.GetRequiredService<AppDbContext>();
            db.Formacoes.Add(new Formacao { Id = formationId, AlunoId = ownerId, Nome = "Course", NomeBusca = "course", Instituicao = "School" });
            await db.SaveChangesAsync();
        });
        using var other = factory.Client();
        await ApiFactory.LoginAsync(other, otherEmail);
        await ApiFactory.SetCsrfAsync(other);
        var url = $"/api/alunos/me/formacoes/{formationId}/certificado";
        Assert.Equal(HttpStatusCode.NotFound, (await UploadAsync(other, url, "x.pdf", "application/pdf", Pdf)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.DeleteAsync(url)).StatusCode);
        using var owner = factory.Client();
        await ApiFactory.LoginAsync(owner, ownerEmail);
        await ApiFactory.SetCsrfAsync(owner);
        await UploadAsync(owner, url, "x.pdf", "application/pdf", Pdf);
        await factory.InScopeAsync(async p => Assert.Null((await p.GetRequiredService<AppDbContext>().Formacoes.SingleAsync()).StatusValidacaoRpv));
    }

    [Fact]
    public async Task Failed_database_replacement_cleans_new_file_and_preserves_old_reference_and_file()
    {
        using var factory = new ApiFactory();
        var email = $"{Guid.NewGuid():N}@example.test";
        var id = await factory.CreateUserAsync(email);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        await UploadAsync(client, "/api/alunos/me/foto", "old.jpg", "image/jpeg", Jpeg);
        string oldKey = "";
        await factory.InScopeAsync(async p =>
        {
            var db = p.GetRequiredService<AppDbContext>();
            oldKey = (await db.Alunos.SingleAsync(x => x.UserId == id)).FotoStorageKey!;
            await db.Database.ExecuteSqlRawAsync("CREATE TRIGGER fail_photo_update BEFORE UPDATE OF FotoStorageKey ON Alunos BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
        });
        Assert.Equal(HttpStatusCode.InternalServerError,
            (await UploadAsync(client, "/api/alunos/me/foto", "new.jpg", "image/jpeg", [0xff, 0xd8, 0xff, 2])).StatusCode);
        Assert.True(File.Exists(Path.Combine(factory.StoragePath, "fotos", oldKey)));
        Assert.Single(Directory.GetFiles(Path.Combine(factory.StoragePath, "fotos")));
        await factory.InScopeAsync(async p => Assert.Equal(oldKey,
            (await p.GetRequiredService<AppDbContext>().Alunos.AsNoTracking().SingleAsync(x => x.UserId == id)).FotoStorageKey));
    }

    [Fact]
    public async Task Anonymous_recruiter_and_blocked_student_cannot_access_files()
    {
        using var factory = new ApiFactory();
        var studentEmail = $"{Guid.NewGuid():N}@example.test";
        var studentId = await factory.CreateUserAsync(studentEmail);
        var recruiterEmail = $"{Guid.NewGuid():N}@example.test";
        await factory.CreateUserAsync(recruiterEmail, AppRoles.Recruiter);
        using var anonymous = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/alunos/me/foto")).StatusCode);
        using var recruiter = factory.Client();
        await ApiFactory.LoginAsync(recruiter, recruiterEmail);
        Assert.Equal(HttpStatusCode.Forbidden, (await recruiter.GetAsync("/api/alunos/me/foto")).StatusCode);
        using var student = factory.Client();
        await ApiFactory.LoginAsync(student, studentEmail);
        await factory.InScopeAsync(async p =>
        {
            var db = p.GetRequiredService<AppDbContext>();
            (await db.Alunos.SingleAsync(x => x.UserId == studentId)).Ativo = false;
            await db.SaveChangesAsync();
        });
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync("/api/alunos/me/foto")).StatusCode);
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, string endpoint,
        string filename, string mime, byte[] bytes)
    {
        using var multipart = new MultipartFormDataContent();
        var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = MediaTypeHeaderValue.Parse(mime);
        multipart.Add(content, "file", filename);
        return await client.PostAsync(endpoint, multipart);
    }

    private static async Task<string> EmailAsync(ApiFactory factory, Guid id)
    {
        string email = "";
        await factory.InScopeAsync(async p => email = (await p.GetRequiredService<AppDbContext>().Users.SingleAsync(x => x.Id == id)).Email!);
        return email;
    }
}
