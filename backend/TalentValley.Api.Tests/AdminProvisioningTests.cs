using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Email;

namespace TalentValley.Api.Tests;

public sealed class AdminProvisioningTests : IDisposable
{
    private readonly ApiFactory factory = new();

    private async Task<HttpClient> AdminAsync()
    {
        await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, "admin@example.test")).StatusCode);
        await ApiFactory.SetCsrfAsync(client);
        return client;
    }

    internal static object Recruiter(string email = "carlos@example.test", string name = "Carlos Almeida") => new
    {
        nomeCompleto = name, email, empresa = "  Inovação Ágil  ", cargo = " Analista de RH ",
        telefone = " (32) 99999-1001 ", cidade = " Cataguases ", uf = " mg "
    };

    [Theory]
    [InlineData("alunos", AppRoles.Student)]
    [InlineData("recrutadores", AppRoles.Recruiter)]
    public async Task Creation_is_passwordless_atomic_and_delivery_happens_after_commit(string resource, string role)
    {
        using var client = await AdminAsync();
        factory.Emails.ActivationDelivery = async (email, _) => await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var user = await db.Users.SingleAsync(x => x.Email == email);
            Assert.False(user.EmailConfirmed);
            Assert.Null(user.PasswordHash);
            Assert.Equal("PERSON@EXAMPLE.TEST", user.NormalizedEmail);
            var users = provider.GetRequiredService<UserManager<ApplicationUser>>();
            Assert.Equal(role, Assert.Single(await users.GetRolesAsync(user)));
            Assert.Equal("person@example.test", user.Email);
            var entry = await db.Auditorias.SingleAsync();
            Assert.Equal(user.Id.ToString(), entry.EntidadeId);
            Assert.Equal("admin@example.test", entry.AdminEmailSnapshot);
            Assert.Equal((await users.FindByEmailAsync("admin@example.test"))!.Id, entry.AdminUserId);
            if (role == AppRoles.Student)
            {
                var aluno = await db.Alunos.SingleAsync();
                Assert.Equal("joao-silva", aluno.Slug);
                Assert.True(aluno.Ativo);
                Assert.InRange(aluno.AtualizadoEm, DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow);
                Assert.Equal("Acesso do aluno João Silva criado.", entry.Descricao);
            }
            else
            {
                var recruiter = await db.Recrutadores.SingleAsync();
                Assert.Equal(StatusRecrutador.ATIVO, recruiter.Status);
                Assert.Equal("MG", recruiter.Uf);
                Assert.Equal("inovacao agil", recruiter.EmpresaBusca);
            }
        });
        object request = resource == "alunos"
            ? new { nomeCompleto = "  João Silva  ", email = " person@example.test " }
            : Recruiter(" person@example.test ");
        var response = await client.PostAsJsonAsync($"/api/admin/{resource}", request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        var body = JsonDocument.Parse(json).RootElement;
        Assert.Equal(4, body.EnumerateObject().Count());
        Assert.False(response.Headers.Contains("Set-Cookie"));
        if (resource == "recrutadores") Assert.Equal("ATIVO", body.GetProperty("status").GetString());
        var activation = Assert.Single(factory.Emails.Activations);
        var query = QueryHelpers.ParseQuery(new Uri(activation.Link).Query);
        Assert.DoesNotContain(query["token"].ToString(), json);
        Assert.Equal(AppRoles.Admin, (await client.GetFromJsonAsync<UsuarioAutenticadoResponse>("/api/auth/me"))!.Role);
        using var student = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await ApiFactory.LoginAsync(student, "person@example.test")).StatusCode);
        await ApiFactory.SetCsrfAsync(student);
        Assert.Equal(HttpStatusCode.NoContent, (await student.PostAsJsonAsync("/api/auth/activate-account",
            new ActivateAccountRequest("person@example.test", query["token"].ToString(), ApiFactory.Password))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await student.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(student, "person@example.test")).StatusCode);
    }

    [Theory]
    [InlineData("alunos")]
    [InlineData("recrutadores")]
    public async Task Duplicate_email_is_case_insensitive_across_roles(string resource)
    {
        using var client = await AdminAsync();
        await factory.CreateUserAsync("existing@example.test", AppRoles.Recruiter);
        object request = resource == "alunos"
            ? new { nomeCompleto = "João Silva", email = " EXISTING@EXAMPLE.TEST " }
            : Recruiter(" EXISTING@EXAMPLE.TEST ");
        var response = await client.PostAsJsonAsync($"/api/admin/{resource}", request);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType!.MediaType);
        Assert.Empty(factory.Emails.Activations);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.Equal(2, await db.Users.CountAsync());
            Assert.Empty(await db.Auditorias.ToListAsync());
        });
    }

    [Fact]
    public async Task Accented_duplicate_names_get_sequential_slugs_and_normalized_search()
    {
        using var client = await AdminAsync();
        for (var i = 0; i < 3; i++)
            Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/admin/alunos",
                new { nomeCompleto = "João  Silva", email = $"joao{i}@example.test", slug = "ignored" })).StatusCode);
        var page = await client.GetFromJsonAsync<PaginatedResponse<AlunoListItem>>("/api/admin/alunos?search=JO%C3%83O");
        Assert.Equal(3, page!.TotalItems);
        Assert.Equal(new[] { "joao-silva", "joao-silva-2", "joao-silva-3" }, page.Items.Select(x => x.Slug).Order());
        Assert.All(page.Items, x => Assert.Null(x.FotoUrl));
        Assert.Equal(0, (await client.GetFromJsonAsync<PaginatedResponse<AlunoListItem>>(
            "/api/admin/alunos?search=example.test"))!.TotalItems);
    }

    [Theory]
    [InlineData("alunos", AppRoles.Student, "student")]
    [InlineData("recrutadores", AppRoles.Recruiter, "recruiter")]
    public async Task Block_revokes_existing_session_and_transitions_are_idempotent(string resource, string role, string probe)
    {
        using var admin = await AdminAsync();
        var id = await factory.CreateUserAsync("person@example.test", role);
        using var user = factory.Client();
        await ApiFactory.LoginAsync(user, "person@example.test");
        Assert.Equal(HttpStatusCode.NoContent, (await user.GetAsync($"/api/probe/{probe}")).StatusCode);
        for (var i = 0; i < 2; i++)
            Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/admin/{resource}/{id}/bloquear", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.GetAsync($"/api/probe/{probe}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.GetAsync("/api/auth/me")).StatusCode);
        for (var i = 0; i < 2; i++)
            Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/admin/{resource}/{id}/reativar", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await user.GetAsync($"/api/probe/{probe}")).StatusCode);
        await factory.InScopeAsync(async provider =>
        {
            var entries = await provider.GetRequiredService<AppDbContext>().Auditorias.OrderBy(x => x.CriadoEm).ToListAsync();
            Assert.Equal(2, entries.Count);
            Assert.Equal(role + "_BLOQUEADO", entries[0].Acao.ToString());
            Assert.Equal(role + "_REATIVADO", entries[1].Acao.ToString());
        });
    }

    [Theory]
    [InlineData("alunos")]
    [InlineData("recrutadores")]
    public async Task Delivery_failure_keeps_created_account_and_resend_reports_failure(string resource)
    {
        using var client = await AdminAsync();
        factory.Emails.ActivationDelivery = (_, _) => throw new EmailDeliveryUnavailableException();
        object request = resource == "alunos"
            ? new { nomeCompleto = "João Silva", email = "person@example.test" } : Recruiter("person@example.test");
        var response = await client.PostAsJsonAsync($"/api/admin/{resource}", request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var id = JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();
        var failed = await client.PostAsync($"/api/admin/usuarios/{id}/reenviar-ativacao", null);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, failed.StatusCode);
        Assert.Equal("application/problem+json", failed.Content.Headers.ContentType!.MediaType);
        Assert.Empty(factory.Emails.Activations);
        factory.Emails.ActivationDelivery = null;
        var resend = await client.PostAsync($"/api/admin/usuarios/{id}/reenviar-ativacao", null);
        Assert.Equal(HttpStatusCode.Accepted, resend.StatusCode);
        Assert.Equal("", await resend.Content.ReadAsStringAsync());
        Assert.Single(factory.Emails.Activations);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var user = await db.Users.SingleAsync(x => x.Id == id);
            Assert.False(user.EmailConfirmed);
            Assert.Null(user.PasswordHash);
            Assert.Single(await db.Auditorias.ToListAsync());
        });
    }

    [Fact]
    public async Task Resend_generates_a_new_link_and_rejects_activated_or_missing_accounts()
    {
        using var client = await AdminAsync();
        var id = await factory.CreateUserAsync("person@example.test", activated: false);
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsync($"/api/admin/usuarios/{id}/reenviar-ativacao", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsync($"/api/admin/usuarios/{id}/reenviar-ativacao", null)).StatusCode);
        Assert.Equal(2, factory.Emails.Activations.Count);
        Assert.NotEqual(factory.Emails.Activations[0].Link, factory.Emails.Activations[1].Link);
        using var user = factory.Client();
        await ApiFactory.SetCsrfAsync(user);
        var token = QueryHelpers.ParseQuery(new Uri(factory.Emails.Activations[1].Link).Query)["token"].ToString();
        Assert.Equal(HttpStatusCode.NoContent, (await user.PostAsJsonAsync("/api/auth/activate-account",
            new ActivateAccountRequest("person@example.test", token, ApiFactory.Password))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"/api/admin/usuarios/{id}/reenviar-ativacao", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PostAsync($"/api/admin/usuarios/{Guid.NewGuid()}/reenviar-ativacao", null)).StatusCode);
    }

    [Theory]
    [InlineData("alunos", "role")]
    [InlineData("alunos", "domain")]
    [InlineData("alunos", "audit")]
    [InlineData("recrutadores", "role")]
    [InlineData("recrutadores", "domain")]
    [InlineData("recrutadores", "audit")]
    public async Task Required_persistence_failure_rolls_back_everything(string resource, string failure)
    {
        using var client = await AdminAsync();
        var table = failure switch { "role" => "AspNetUserRoles", "audit" => "Auditorias", _ => resource == "alunos" ? "Alunos" : "Recrutadores" };
        // The identifier is selected exclusively from the fixed test table names above.
        var failSql = "CREATE TRIGGER fail_write BEFORE INSERT ON " + table + " BEGIN SELECT RAISE(ABORT, 'test failure'); END;";
        await factory.InScopeAsync(async provider => await provider.GetRequiredService<AppDbContext>().Database.ExecuteSqlRawAsync(failSql));
        object request = resource == "alunos"
            ? new { nomeCompleto = "João Silva", email = "person@example.test" } : Recruiter("person@example.test");
        Assert.Equal(HttpStatusCode.InternalServerError, (await client.PostAsJsonAsync($"/api/admin/{resource}", request)).StatusCode);
        Assert.Empty(factory.Emails.Activations);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.Single(await db.Users.ToListAsync());
            Assert.Single(await db.UserRoles.ToListAsync());
            Assert.Empty(await db.Alunos.ToListAsync());
            Assert.Empty(await db.Recrutadores.ToListAsync());
            Assert.Empty(await db.Auditorias.ToListAsync());
        });
    }

    public void Dispose() => factory.Dispose();
}
