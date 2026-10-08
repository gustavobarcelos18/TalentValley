using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Tests;

public sealed class RecruiterSelfDeletionTests : IDisposable
{
    private const string Email = "recruiter@example.test";
    private readonly ApiFactory factory = new();

    [Fact]
    public async Task Recruiter_deletes_own_account_with_password_removing_profile_favorites_and_requests()
    {
        var studentId = await factory.CreateUserAsync("student@example.test");
        var id = await factory.CreateUserAsync(Email, AppRoles.Recruiter);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            db.Favoritos.Add(new Favorito { AlunoId = studentId, RecrutadorId = id, CriadoEm = DateTimeOffset.UtcNow });
            db.SolicitacoesCadastro.Add(new SolicitacaoCadastro
            {
                Id = Guid.NewGuid(), Tipo = TipoSolicitacaoCadastro.RECRUTADOR, NomeCompleto = "Maria Álvares",
                Email = Email, EmailNormalizado = Email.ToUpperInvariant()
            });
            await db.SaveChangesAsync();
        });
        using var recruiter = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(recruiter, Email)).StatusCode);
        await ApiFactory.SetCsrfAsync(recruiter);

        Assert.Equal(HttpStatusCode.BadRequest, (await DeleteOwnAsync(recruiter, "WrongPassword123")).StatusCode);
        await factory.InScopeAsync(async provider =>
            Assert.True(await provider.GetRequiredService<AppDbContext>().Recrutadores.AnyAsync(x => x.UserId == id)));

        var response = await DeleteOwnAsync(recruiter, ApiFactory.Password);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Contains(response.Headers.GetValues("Set-Cookie"), x => x.StartsWith($"{AuthCookie.Name}=;"));

        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.False(await db.Users.AnyAsync(x => x.Id == id));
            Assert.False(await db.UserRoles.AnyAsync(x => x.UserId == id));
            Assert.False(await db.Recrutadores.AnyAsync(x => x.UserId == id));
            Assert.False(await db.Favoritos.AnyAsync());
            Assert.Empty(await db.SolicitacoesCadastro.ToListAsync());
            Assert.True(await db.Alunos.AnyAsync(x => x.UserId == studentId));
            var entry = await db.Auditorias.SingleAsync(x => x.Acao == AcaoAuditoria.RECRUTADOR_EXCLUIDO_PROPRIO);
            Assert.Null(entry.AdminUserId);
            Assert.Equal("Próprio recrutador", entry.AdminEmailSnapshot);
            Assert.Equal(AppRoles.Recruiter, entry.EntidadeTipo);
            Assert.Equal(id.ToString(), entry.EntidadeId);
            Assert.DoesNotContain("Maria", entry.Descricao);
        });

        // The old session and the credentials no longer authenticate.
        Assert.Equal(HttpStatusCode.Unauthorized, (await recruiter.GetAsync("/api/auth/me")).StatusCode);
        using var fresh = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await ApiFactory.LoginAsync(fresh, Email)).StatusCode);
    }

    [Fact]
    public async Task Self_deletion_requires_csrf_and_an_active_recruiter()
    {
        var recruiterId = await factory.CreateUserAsync(Email, AppRoles.Recruiter);
        await factory.CreateUserAsync("student@example.test");

        using var anonymous = factory.Client();
        await ApiFactory.SetCsrfAsync(anonymous);
        Assert.Equal(HttpStatusCode.Unauthorized, (await DeleteOwnAsync(anonymous, ApiFactory.Password)).StatusCode);

        using var student = factory.Client();
        await ApiFactory.LoginAsync(student, "student@example.test");
        await ApiFactory.SetCsrfAsync(student);
        Assert.Equal(HttpStatusCode.Forbidden, (await DeleteOwnAsync(student, ApiFactory.Password)).StatusCode);

        using var recruiter = factory.Client();
        await ApiFactory.LoginAsync(recruiter, Email);
        recruiter.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await DeleteOwnAsync(recruiter, ApiFactory.Password)).StatusCode);

        // A recruiter blocked after logging in is denied by the active-account policy.
        await ApiFactory.SetCsrfAsync(recruiter);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            (await db.Recrutadores.SingleAsync(x => x.UserId == recruiterId)).Status = StatusRecrutador.BLOQUEADO;
            await db.SaveChangesAsync();
        });
        Assert.Equal(HttpStatusCode.Forbidden, (await DeleteOwnAsync(recruiter, ApiFactory.Password)).StatusCode);

        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.True(await db.Recrutadores.AnyAsync(x => x.UserId == recruiterId));
            Assert.Equal(2, await db.Users.CountAsync());
            Assert.Empty(await db.Auditorias.ToListAsync());
        });
    }

    [Fact]
    public async Task Self_deletion_locks_out_after_repeated_wrong_passwords_and_preserves_account()
    {
        var id = await factory.CreateUserAsync(Email, AppRoles.Recruiter);
        using var recruiter = factory.Client();
        await ApiFactory.LoginAsync(recruiter, Email);
        await ApiFactory.SetCsrfAsync(recruiter);

        var status = HttpStatusCode.BadRequest;
        for (var attempt = 0; attempt < 10 && status != HttpStatusCode.Locked; attempt++)
            status = (await DeleteOwnAsync(recruiter, "WrongPassword123")).StatusCode;
        Assert.Equal(HttpStatusCode.Locked, status);

        // Even the right password is refused while locked out.
        Assert.Equal(HttpStatusCode.Locked, (await DeleteOwnAsync(recruiter, ApiFactory.Password)).StatusCode);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.True(await db.Users.AnyAsync(x => x.Id == id));
            Assert.True(await db.Recrutadores.AnyAsync(x => x.UserId == id));
            Assert.Empty(await db.Auditorias.ToListAsync());
        });
    }

    private static Task<HttpResponseMessage> DeleteOwnAsync(HttpClient client, string password) =>
        client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, "/api/recrutador/me")
        {
            Content = JsonContent.Create(new DeleteOwnProfileRequest(password))
        });

    public void Dispose() => factory.Dispose();
}
