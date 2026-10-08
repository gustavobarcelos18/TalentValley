using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class Phase1Tests
{
    private static ApiFactory LimitedFactory() => new() { Overrides = { ["RateLimiting:PermitLimit"] = "5" } };

    private static object Student(string email) => new
    {
        nomeCompleto = "Ana Silva", email, telefone = "(32) 99999-0000", cidade = "Rio Pomba", uf = "MG",
        instituicaoEnsino = "IF Sudeste MG", curso = "Sistemas de Informação", tipoFormacao = "GRADUACAO", consentTermos = true
    };
    private static object Recruiter(string email) => new
    {
        nomeCompleto = "Carlos Souza", email, telefone = "(32) 99999-0001", cidade = "Ubá", uf = "MG",
        empresa = "Empresa Exemplo", cargo = "Analista de RH", siteEmpresa = "https://example.test", consentTermos = true
    };

    // B2. Invalid tokens are rejected with 400 (never 429) until the window is exhausted.
    [Theory]
    [InlineData("/api/auth/activate-account", "senha")]
    [InlineData("/api/auth/reset-password", "novaSenha")]
    public async Task Activate_and_reset_password_reject_the_sixth_request_within_a_minute(string path, string passwordField)
    {
        using var factory = LimitedFactory();
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        for (var i = 0; i < 5; i++)
        {
            var response = await client.PostAsJsonAsync(path, new Dictionary<string, string>
            {
                ["email"] = "ana@example.test", ["token"] = $"invalid-token-{i}", [passwordField] = "NovaSenha12345"
            });
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        var limited = await client.PostAsJsonAsync(path, new Dictionary<string, string>
        {
            ["email"] = "ana@example.test", ["token"] = "invalid-token-6", [passwordField] = "NovaSenha12345"
        });
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode);
    }

    // B5
    [Theory]
    [InlineData("aluno")]
    [InlineData("recrutador")]
    public async Task Duplicate_registration_returns_the_same_202_and_creates_no_second_request(string kind)
    {
        using var factory = new ApiFactory();
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        object Body(string email) => kind == "aluno" ? Student(email) : Recruiter(email);

        var first = await client.PostAsJsonAsync($"/api/cadastro/{kind}", Body("test@example.com"));
        Assert.Equal(HttpStatusCode.Accepted, first.StatusCode);
        await factory.InScopeAsync(async provider =>
            Assert.Single(await provider.GetRequiredService<AppDbContext>().SolicitacoesCadastro.ToListAsync()));

        var second = await client.PostAsJsonAsync($"/api/cadastro/{kind}", Body("TEST@example.com"));
        Assert.Equal(HttpStatusCode.Accepted, second.StatusCode);
        Assert.Equal(await first.Content.ReadAsStringAsync(), await second.Content.ReadAsStringAsync());
        await factory.InScopeAsync(async provider =>
            Assert.Single(await provider.GetRequiredService<AppDbContext>().SolicitacoesCadastro.ToListAsync()));
    }

    [Fact]
    public async Task Registration_for_an_existing_account_returns_202_and_creates_no_request()
    {
        using var factory = new ApiFactory();
        await factory.CreateUserAsync("existing@example.test", AppRoles.Student);
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);

        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/cadastro/aluno", Student("existing@example.test"))).StatusCode);
        await factory.InScopeAsync(async provider =>
            Assert.Empty(await provider.GetRequiredService<AppDbContext>().SolicitacoesCadastro.ToListAsync()));
    }

    // I8
    [Theory]
    [InlineData("aluno", AcaoAuditoria.ALUNO_CRIADO, "ALUNO")]
    [InlineData("recrutador", AcaoAuditoria.RECRUTADOR_CRIADO, "RECRUTADOR")]
    public async Task Approving_a_request_writes_the_approval_and_profile_creation_audit_rows(string kind, AcaoAuditoria createdAction, string entityType)
    {
        using var factory = new ApiFactory();
        using var publicClient = factory.Client();
        await ApiFactory.SetCsrfAsync(publicClient);
        var body = kind == "aluno" ? Student("new@example.test") : Recruiter("new@example.test");
        Assert.Equal(HttpStatusCode.Accepted, (await publicClient.PostAsJsonAsync($"/api/cadastro/{kind}", body)).StatusCode);
        Guid requestId = Guid.Empty;
        await factory.InScopeAsync(async provider =>
            requestId = await provider.GetRequiredService<AppDbContext>().SolicitacoesCadastro.Select(x => x.Id).SingleAsync());

        var adminId = await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        using var admin = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(admin, "admin@example.test")).StatusCode);
        await ApiFactory.SetCsrfAsync(admin);
        var approval = await admin.PostAsync($"/api/admin/solicitacoes-cadastro/{requestId}/aprovar", null);
        Assert.Equal(HttpStatusCode.OK, approval.StatusCode);
        var result = await approval.Content.ReadFromJsonAsync<SolicitacaoAprovacaoResponse>(ApiFactory.JsonOptions);

        await factory.InScopeAsync(async provider =>
        {
            var rows = await provider.GetRequiredService<AppDbContext>().Auditorias.ToListAsync();
            Assert.Equal(2, rows.Count);
            var approved = Assert.Single(rows, x => x.Acao == AcaoAuditoria.SOLICITACAO_CADASTRO_APROVADA);
            var created = Assert.Single(rows, x => x.Acao == createdAction);
            Assert.Equal(requestId.ToString(), approved.EntidadeId);
            Assert.Equal(result!.UserId.ToString(), created.EntidadeId);
            Assert.Equal(entityType == "ALUNO" ? AppRoles.Student : AppRoles.Recruiter, created.EntidadeTipo);
            // Both rows are staged in the same unit of work as the user, profile and request status.
            Assert.Equal(adminId, approved.AdminUserId);
            Assert.Equal(adminId, created.AdminUserId);
        });
    }
}
