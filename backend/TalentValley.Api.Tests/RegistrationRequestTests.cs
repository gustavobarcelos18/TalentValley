using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class RegistrationRequestTests : IDisposable
{
    private readonly ApiFactory factory = new();
    private static object Student(string email = "ana@example.test") => new
    {
        nomeCompleto = "Ana Silva", email, telefone = "(32) 99999-0000", cidade = "Rio Pomba", uf = "mg",
        instituicaoEnsino = "IF Sudeste MG", curso = "Sistemas de Informação", tipoFormacao = "GRADUACAO",
        anoConclusaoPrevisto = 2027, relacaoRioPombaValley = "Estudante da região"
    };
    private static object Recruiter(string email = "rh@example.test") => new
    {
        nomeCompleto = "Carlos Souza", email, telefone = "(32) 99999-0001", cidade = "Ubá", uf = "mg",
        empresa = "Empresa Exemplo", cargo = "Analista de RH", siteEmpresa = "https://example.test"
    };

    [Fact]
    public async Task Public_student_request_creates_only_pending_request_and_normalizes_email()
    {
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        var response = await client.PostAsJsonAsync("/api/cadastro/aluno", Student(" ANA@EXAMPLE.TEST "));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<SolicitacaoCadastroCreatedResponse>(ApiFactory.JsonOptions);
        Assert.Equal(StatusSolicitacaoCadastro.PENDENTE, result!.Status);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var request = await db.SolicitacoesCadastro.SingleAsync();
            Assert.Equal("ANA@EXAMPLE.TEST", request.EmailNormalizado);
            Assert.Equal("MG", request.Uf);
            Assert.Equal(TipoFormacao.GRADUACAO, request.TipoFormacao);
            Assert.Empty(await db.Alunos.ToListAsync());
            Assert.Empty(await db.Users.Where(x => x.Email == "ANA@EXAMPLE.TEST").ToListAsync());
        });
    }

    [Fact]
    public async Task Admin_pending_list_returns_created_request()
    {
        using var publicClient = factory.Client();
        await ApiFactory.SetCsrfAsync(publicClient);
        var created = await publicClient.PostAsJsonAsync("/api/cadastro/aluno", Student());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var request = await created.Content.ReadFromJsonAsync<SolicitacaoCadastroCreatedResponse>(ApiFactory.JsonOptions);

        await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        using var admin = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(admin, "admin@example.test")).StatusCode);
        var response = await admin.GetAsync("/api/admin/solicitacoes-cadastro?status=PENDENTE");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var list = await response.Content.ReadFromJsonAsync<PaginatedResponse<SolicitacaoCadastroListItem>>(ApiFactory.JsonOptions);
        Assert.Equal(1, list!.TotalItems);
        Assert.Equal(request!.Id, Assert.Single(list.Items).Id);
    }

    [Fact]
    public async Task Admin_list_keeps_status_date_id_order_and_pagination_after_filtering()
    {
        var timestamp = new DateTimeOffset(2026, 9, 16, 12, 0, 0, TimeSpan.Zero);
        var pendingIds = Enumerable.Range(1, 11).Select(i => new Guid(i, 0, 0, new byte[8])).ToArray();
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            for (var i = 0; i < pendingIds.Length; i++)
                db.SolicitacoesCadastro.Add(new SolicitacaoCadastro
                {
                    Id = pendingIds[i], Tipo = TipoSolicitacaoCadastro.ALUNO, Status = StatusSolicitacaoCadastro.PENDENTE,
                    NomeCompleto = $"Pedido {i + 1:D2}", Email = $"pedido{i + 1}@example.test",
                    EmailNormalizado = $"PEDIDO{i + 1}@EXAMPLE.TEST", Telefone = "32999990000", Cidade = "Rio Pomba", Uf = "MG",
                    CriadoEm = i < 2 ? timestamp : timestamp.AddMinutes(-i)
                });
            db.SolicitacoesCadastro.Add(new SolicitacaoCadastro
            {
                Id = Guid.NewGuid(), Tipo = TipoSolicitacaoCadastro.RECRUTADOR, Status = StatusSolicitacaoCadastro.APROVADA,
                NomeCompleto = "Aprovado", Email = "aprovado@example.test", EmailNormalizado = "APROVADO@EXAMPLE.TEST",
                Telefone = "32999990000", Cidade = "Rio Pomba", Uf = "MG", CriadoEm = timestamp.AddDays(1)
            });
            await db.SaveChangesAsync();
        });

        await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        using var admin = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(admin, "admin@example.test")).StatusCode);

        var first = await admin.GetFromJsonAsync<PaginatedResponse<SolicitacaoCadastroListItem>>(
            "/api/admin/solicitacoes-cadastro?status=PENDENTE", ApiFactory.JsonOptions);
        Assert.Equal(11, first!.TotalItems);
        Assert.Equal(2, first.TotalPages);
        Assert.Equal(pendingIds.Take(10), first.Items.Select(x => x.Id));

        var second = await admin.GetFromJsonAsync<PaginatedResponse<SolicitacaoCadastroListItem>>(
            "/api/admin/solicitacoes-cadastro?status=PENDENTE&page=2", ApiFactory.JsonOptions);
        Assert.Equal(new[] { pendingIds[10] }, second!.Items.Select(x => x.Id));

        var all = await admin.GetFromJsonAsync<PaginatedResponse<SolicitacaoCadastroListItem>>(
            "/api/admin/solicitacoes-cadastro", ApiFactory.JsonOptions);
        Assert.Equal(12, all!.TotalItems);
        Assert.Equal(pendingIds.Take(10), all.Items.Select(x => x.Id));

        var searched = await admin.GetFromJsonAsync<PaginatedResponse<SolicitacaoCadastroListItem>>(
            "/api/admin/solicitacoes-cadastro?status=PENDENTE&search=Pedido%2005", ApiFactory.JsonOptions);
        Assert.Equal(pendingIds[4], Assert.Single(searched!.Items).Id);
    }

    [Fact]
    public async Task Duplicate_pending_and_existing_account_emails_are_rejected_but_rejected_request_can_resubmit()
    {
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/cadastro/recrutador", Recruiter())).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/cadastro/recrutador", Recruiter(" RH@EXAMPLE.TEST "))).StatusCode);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            (await db.SolicitacoesCadastro.SingleAsync()).Status = StatusSolicitacaoCadastro.REJEITADA;
            await db.SaveChangesAsync();
        });
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/cadastro/recrutador", Recruiter())).StatusCode);
        await factory.CreateUserAsync("existing@example.test", AppRoles.Student);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/cadastro/aluno", Student("EXISTING@example.test"))).StatusCode);
    }

    [Theory]
    [InlineData("João123", "Rio Pomba", "32999990000", "MG")]
    [InlineData("João da Silva", "Cidade123", "32999990000", "MG")]
    [InlineData("João da Silva", "Rio Pomba", "abc99999999", "MG")]
    [InlineData("João da Silva", "Rio Pomba", "32999990000", "XX")]
    public async Task Public_registration_rejects_invalid_semantic_identity_fields(string name, string city, string phone, string uf)
    {
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        var response = await client.PostAsJsonAsync("/api/cadastro/aluno", new
        {
            nomeCompleto = name, email = "valid@example.test", telefone = phone, cidade = city, uf,
            instituicaoEnsino = "IF Sudeste MG", curso = "CS50", tipoFormacao = "GRADUACAO"
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("553299999000012")]
    [InlineData("32999\n990000")]
    public async Task Public_registration_rejects_an_invalid_phone_instead_of_silently_changing_it(string phone)
    {
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);

        var response = await client.PostAsJsonAsync("/api/cadastro/aluno", new
        {
            nomeCompleto = "Ana Silva", email = "overlong-phone@example.test", telefone = phone,
            cidade = "Rio Pomba", uf = "MG", instituicaoEnsino = "IF Sudeste MG", curso = "CS50",
            tipoFormacao = "GRADUACAO"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Recruiter_registration_rejects_unsafe_url_but_accepts_business_and_technology_text()
    {
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        var invalid = await client.PostAsJsonAsync("/api/cadastro/recrutador", new
        {
            nomeCompleto = "João D'Ávila", email = "secure-url@example.test", telefone = "32999990000", cidade = "São João del-Rei", uf = "MG",
            empresa = "3M", cargo = "Desenvolvedor .NET N2", siteEmpresa = "javascript:alert(1)"
        });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        var valid = await client.PostAsJsonAsync("/api/cadastro/recrutador", new
        {
            nomeCompleto = "João D'Ávila", email = "business-text@example.test", telefone = "32999990000", cidade = "São João del-Rei", uf = "MG",
            empresa = "3M", cargo = "Desenvolvedor .NET N2", siteEmpresa = "https://example.test"
        });
        Assert.Equal(HttpStatusCode.Created, valid.StatusCode);
    }

    [Theory]
    [InlineData("joao\U0001F600@empresa.com")]
    [InlineData("nome @empresa.com")]
    public async Task Public_registration_rejects_email_that_contains_invalid_characters(string email)
    {
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);

        var response = await client.PostAsJsonAsync("/api/cadastro/aluno", Student(email));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Recruiter_registration_rejects_emoji_in_url()
    {
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        var response = await client.PostAsJsonAsync("/api/cadastro/recrutador", new
        {
            nomeCompleto = "Ana Maria", email = "url-emoji@example.test", telefone = "32999990000", cidade = "Rio Pomba", uf = "MG",
            empresa = "3M", cargo = "Analista N2", siteEmpresa = "https://example\U0001F600.test"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Admin_approval_creates_real_student_and_activation_only_after_approval()
    {
        using var publicClient = factory.Client();
        await ApiFactory.SetCsrfAsync(publicClient);
        Assert.Equal(HttpStatusCode.Created, (await publicClient.PostAsJsonAsync("/api/cadastro/aluno", Student())).StatusCode);
        var adminId = await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        using var admin = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(admin, "admin@example.test")).StatusCode);
        await ApiFactory.SetCsrfAsync(admin);
        Guid requestId = Guid.Empty;
        await factory.InScopeAsync(async provider => requestId = await provider.GetRequiredService<AppDbContext>().SolicitacoesCadastro.Select(x => x.Id).SingleAsync());
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/admin/solicitacoes-cadastro/{requestId}/aprovar", null)).StatusCode);
        Assert.Single(factory.Emails.Activations);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var request = await db.SolicitacoesCadastro.SingleAsync();
            var user = await db.Users.SingleAsync(x => x.Email == "ana@example.test");
            var manager = provider.GetRequiredService<UserManager<ApplicationUser>>();
            Assert.Equal(StatusSolicitacaoCadastro.APROVADA, request.Status);
            Assert.Equal(adminId, request.AdminUserId);
            Assert.True(await manager.IsInRoleAsync(user, AppRoles.Student));
            var aluno = await db.Alunos.SingleAsync(x => x.UserId == user.Id);
            Assert.Equal("Rio Pomba", aluno.Cidade);
            Assert.Equal("ana@example.test", aluno.EmailProfissional);
            Assert.Contains(await db.Auditorias.ToListAsync(), x => x.Acao == AcaoAuditoria.SOLICITACAO_CADASTRO_APROVADA);
        });
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsync($"/api/admin/solicitacoes-cadastro/{requestId}/aprovar", null)).StatusCode);
    }

    [Fact]
    public async Task Public_recruiter_request_requires_csrf_and_admin_approval_creates_recruiter()
    {
        using var publicClient = factory.Client();
        Assert.Equal(HttpStatusCode.BadRequest, (await publicClient.PostAsJsonAsync("/api/cadastro/recrutador", Recruiter())).StatusCode);
        await ApiFactory.SetCsrfAsync(publicClient);
        Assert.Equal(HttpStatusCode.Created, (await publicClient.PostAsJsonAsync("/api/cadastro/recrutador", Recruiter())).StatusCode);
        var requestId = await RequestIdAsync();
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.Empty(await db.Users.ToListAsync());
            Assert.Empty(await db.Recrutadores.ToListAsync());
        });

        using var anonymous = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/admin/solicitacoes-cadastro")).StatusCode);
        await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        using var admin = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(admin, "admin@example.test")).StatusCode);
        await ApiFactory.SetCsrfAsync(admin);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/admin/solicitacoes-cadastro/{requestId}/aprovar", null)).StatusCode);
        Assert.Single(factory.Emails.Activations);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var user = await db.Users.SingleAsync(x => x.Email == "rh@example.test");
            var recruiter = await db.Recrutadores.SingleAsync(x => x.UserId == user.Id);
            Assert.Equal("Empresa Exemplo", recruiter.Empresa);
            Assert.Equal(StatusRecrutador.ATIVO, recruiter.Status);
            Assert.True(await provider.GetRequiredService<UserManager<ApplicationUser>>().IsInRoleAsync(user, AppRoles.Recruiter));
        });
    }

    [Fact]
    public async Task Admin_rejection_is_audited_and_never_creates_an_account()
    {
        using var publicClient = factory.Client();
        await ApiFactory.SetCsrfAsync(publicClient);
        Assert.Equal(HttpStatusCode.Created, (await publicClient.PostAsJsonAsync("/api/cadastro/aluno", Student())).StatusCode);
        var requestId = await RequestIdAsync();
        await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        using var admin = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(admin, "admin@example.test")).StatusCode);
        await ApiFactory.SetCsrfAsync(admin);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsJsonAsync($"/api/admin/solicitacoes-cadastro/{requestId}/rejeitar", new { motivo = "Dados insuficientes" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsync($"/api/admin/solicitacoes-cadastro/{requestId}/aprovar", null)).StatusCode);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var request = await db.SolicitacoesCadastro.SingleAsync();
            Assert.Equal(StatusSolicitacaoCadastro.REJEITADA, request.Status);
            Assert.Equal("Dados insuficientes", request.MotivoRejeicao);
            Assert.NotNull(request.AnalisadoEm);
            Assert.Empty(await db.Users.Where(x => x.Email == "ana@example.test").ToListAsync());
            Assert.Contains(await db.Auditorias.ToListAsync(), x => x.Acao == AcaoAuditoria.SOLICITACAO_CADASTRO_REJEITADA);
        });
        Assert.Empty(factory.Emails.Activations);
    }

    private async Task<Guid> RequestIdAsync()
    {
        Guid id = Guid.Empty;
        await factory.InScopeAsync(async provider => id = await provider.GetRequiredService<AppDbContext>().SolicitacoesCadastro.Select(x => x.Id).SingleAsync());
        return id;
    }

    public void Dispose() => factory.Dispose();
}
