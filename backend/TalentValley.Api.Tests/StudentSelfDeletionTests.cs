using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Tests;

public sealed class StudentSelfDeletionTests : IDisposable
{
    private const string Email = "ana@example.test";
    private readonly ApiFactory factory = new();

    [Fact]
    public async Task Student_deletes_own_account_with_password_removing_profile_files_and_requests()
    {
        var id = await RegisterApproveAndActivateAsync();
        using var student = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(student, Email)).StatusCode);
        await ApiFactory.SetCsrfAsync(student);
        var storedFiles = await AttachFilesAsync(id);

        Assert.Equal(HttpStatusCode.BadRequest, (await DeleteOwnAsync(student, "WrongPassword123")).StatusCode);
        await factory.InScopeAsync(async provider =>
            Assert.True(await provider.GetRequiredService<AppDbContext>().Alunos.AnyAsync(x => x.UserId == id)));

        var response = await DeleteOwnAsync(student, ApiFactory.Password);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Contains(response.Headers.GetValues("Set-Cookie"), x => x.StartsWith($"{AuthCookie.Name}=;"));

        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var storage = provider.GetRequiredService<IFileStorage>();
            Assert.False(await db.Users.AnyAsync(x => x.Id == id));
            Assert.False(await db.UserRoles.AnyAsync(x => x.UserId == id));
            Assert.False(await db.Alunos.AnyAsync(x => x.UserId == id));
            Assert.False(await db.Formacoes.AnyAsync());
            Assert.Empty(await db.SolicitacoesCadastro.ToListAsync());
            foreach (var file in storedFiles)
                Assert.False(await storage.ExistsAsync(file.Category, file.Key));
            var entry = await db.Auditorias.SingleAsync(x => x.Acao == AcaoAuditoria.ALUNO_EXCLUIDO_PROPRIO);
            Assert.Null(entry.AdminUserId);
            Assert.Equal(AuditoriaService.StudentSelfServiceActor, entry.AdminEmailSnapshot);
            Assert.Equal(AppRoles.Student, entry.EntidadeTipo);
            Assert.Equal(id.ToString(), entry.EntidadeId);
            Assert.DoesNotContain("Ana", entry.Descricao);
        });

        // The old session and the credentials no longer authenticate.
        Assert.Equal(HttpStatusCode.Unauthorized, (await student.GetAsync("/api/auth/me")).StatusCode);
        using var fresh = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await ApiFactory.LoginAsync(fresh, Email)).StatusCode);
    }

    [Fact]
    public async Task Self_deletion_requires_csrf_and_an_active_student()
    {
        var studentId = await factory.CreateUserAsync("student@example.test");
        await factory.CreateUserAsync("recruiter@example.test", AppRoles.Recruiter);

        using var anonymous = factory.Client();
        await ApiFactory.SetCsrfAsync(anonymous);
        Assert.Equal(HttpStatusCode.Unauthorized, (await DeleteOwnAsync(anonymous, ApiFactory.Password)).StatusCode);

        using var student = factory.Client();
        await ApiFactory.LoginAsync(student, "student@example.test");
        student.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await DeleteOwnAsync(student, ApiFactory.Password)).StatusCode);

        using var recruiter = factory.Client();
        await ApiFactory.LoginAsync(recruiter, "recruiter@example.test");
        await ApiFactory.SetCsrfAsync(recruiter);
        Assert.Equal(HttpStatusCode.Forbidden, (await DeleteOwnAsync(recruiter, ApiFactory.Password)).StatusCode);

        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.True(await db.Alunos.AnyAsync(x => x.UserId == studentId));
            Assert.Equal(2, await db.Users.CountAsync());
            Assert.Empty(await db.Auditorias.ToListAsync());
        });
    }

    private static Task<HttpResponseMessage> DeleteOwnAsync(HttpClient client, string password) =>
        client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/alunos/me")
        {
            Content = JsonContent.Create(new DeleteOwnProfileRequest(password))
        });

    // Public request -> admin approval -> activation, the real onboarding path.
    private async Task<Guid> RegisterApproveAndActivateAsync()
    {
        using var publicClient = factory.Client();
        await ApiFactory.SetCsrfAsync(publicClient);
        Assert.Equal(HttpStatusCode.Accepted, (await publicClient.PostAsJsonAsync("/api/cadastro/aluno", new
        {
            nomeCompleto = "Ana Silva", email = Email, telefone = "(32) 99999-0000", cidade = "Rio Pomba", uf = "MG",
            instituicaoEnsino = "IF Sudeste MG", curso = "Sistemas de Informação", tipoFormacao = "GRADUACAO",
            consentTermos = true
        })).StatusCode);

        await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        using var admin = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(admin, "admin@example.test")).StatusCode);
        await ApiFactory.SetCsrfAsync(admin);
        Guid requestId = Guid.Empty;
        await factory.InScopeAsync(async provider => requestId = await provider.GetRequiredService<AppDbContext>()
            .SolicitacoesCadastro.Select(x => x.Id).SingleAsync());
        var approval = await admin.PostAsync($"/api/admin/solicitacoes-cadastro/{requestId}/aprovar", null);
        Assert.Equal(HttpStatusCode.OK, approval.StatusCode);
        var userId = (await approval.Content.ReadFromJsonAsync<SolicitacaoAprovacaoResponse>(ApiFactory.JsonOptions))!.UserId;

        var query = QueryHelpers.ParseQuery(new Uri(Assert.Single(factory.Emails.Activations).Link).Query);
        Assert.Equal(HttpStatusCode.NoContent, (await publicClient.PostAsJsonAsync("/api/auth/activate-account",
            new ActivateAccountRequest(Email, query["token"].ToString(), ApiFactory.Password))).StatusCode);
        return userId;
    }

    private async Task<List<(FileCategory Category, string Key)>> AttachFilesAsync(Guid id)
    {
        var files = new List<(FileCategory Category, string Key)>();
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var storage = provider.GetRequiredService<IFileStorage>();
            var aluno = await db.Alunos.SingleAsync(x => x.UserId == id);
            aluno.FotoStorageKey = await storage.StoreAsync(FileCategory.Photo, new MemoryStream([0xff, 0xd8, 0xff]), ".jpg");
            aluno.CurriculoStorageKey = await storage.StoreAsync(FileCategory.Curriculum,
                new MemoryStream("%PDF-cv"u8.ToArray()), ".pdf");
            var certificateKey = await storage.StoreAsync(FileCategory.Certificate,
                new MemoryStream("%PDF-proof"u8.ToArray()), ".pdf");
            db.Formacoes.Add(new Formacao
            {
                Id = Guid.NewGuid(), AlunoId = id, Nome = "Curso", NomeBusca = "curso", Instituicao = "RPV",
                CertificadoStorageKey = certificateKey
            });
            await db.SaveChangesAsync();
            files.Add((FileCategory.Photo, aluno.FotoStorageKey));
            files.Add((FileCategory.Curriculum, aluno.CurriculoStorageKey));
            files.Add((FileCategory.Certificate, certificateKey));
            foreach (var file in files) Assert.True(await storage.ExistsAsync(file.Category, file.Key));
        });
        return files;
    }

    public void Dispose() => factory.Dispose();
}
