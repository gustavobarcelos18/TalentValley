using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Tests;

public sealed class AdminRpvValidationTests : IDisposable
{
    private static readonly byte[] Pdf = "%PDF-1.7 admin certificate"u8.ToArray();
    private readonly ApiFactory factory = new();

    [Fact]
    public async Task Queue_filters_orders_paginates_and_exposes_only_safe_data()
    {
        using var admin = await LoginAsync("admin@example.test", AppRoles.Admin);
        var studentId = await factory.CreateUserAsync("student@example.test");
        await SetStudentAsync(studentId, "Maria Silva", "maria silva", "maria-silva", true, "Rio Pomba", "MG");

        var expected = new List<Guid>();
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var start = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
            for (var i = 0; i < 12; i++)
            {
                var id = Guid.NewGuid();
                expected.Add(id);
                db.Formacoes.Add(Formation(id, studentId, StatusValidacaoRpv.PENDENTE,
                    updatedAt: start.AddMinutes(i), certificateKey: i == 0 ? "00000000000000000000000000000000.pdf" : null));
            }
            db.Formacoes.Add(Formation(Guid.NewGuid(), studentId, StatusValidacaoRpv.VERIFICADO));
            db.Formacoes.Add(Formation(Guid.NewGuid(), studentId, StatusValidacaoRpv.REJEITADO));
            db.Formacoes.Add(Formation(Guid.NewGuid(), studentId, null, rpv: false));
            await db.SaveChangesAsync();
        });

        var firstJson = await admin.GetStringAsync("/api/admin/validacoes-rpv");
        var first = JsonSerializer.Deserialize<PaginatedResponse<RpvValidationListItem>>(firstJson, ApiFactory.JsonOptions)!;
        var second = await admin.GetFromJsonAsync<PaginatedResponse<RpvValidationListItem>>(
            "/api/admin/validacoes-rpv?page=2", ApiFactory.JsonOptions);

        Assert.Equal(10, first.PageSize);
        Assert.Equal(12, first.TotalItems);
        Assert.Equal(2, first.TotalPages);
        Assert.Equal(expected.Take(10), first.Items.Select(x => x.FormacaoId));
        Assert.Equal(expected.Skip(10), second!.Items.Select(x => x.FormacaoId));
        var item = first.Items.First();
        Assert.Equal(studentId, item.AlunoId);
        Assert.Equal("Maria Silva", item.AlunoNome);
        Assert.Equal("maria-silva", item.AlunoSlug);
        Assert.True(item.AlunoAtivo);
        Assert.True(item.PossuiCertificado);
        Assert.DoesNotContain("storageKey", firstJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("password", firstJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("securityStamp", firstJson, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Detail_supports_every_RPV_state_and_hides_non_RPV_or_unknown_formations()
    {
        using var admin = await LoginAsync("admin@example.test", AppRoles.Admin);
        var studentId = await factory.CreateUserAsync("student@example.test");
        await SetStudentAsync(studentId, "Maria Silva", "maria silva", "maria-silva", false, "Rio Pomba", "MG");
        var rpvId = Guid.NewGuid();
        var nonRpvId = Guid.NewGuid();
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            db.Formacoes.Add(Formation(rpvId, studentId, StatusValidacaoRpv.PENDENTE,
                certificateKey: "00000000000000000000000000000000.pdf"));
            db.Formacoes.Add(Formation(nonRpvId, studentId, null, rpv: false));
            await db.SaveChangesAsync();
        });

        foreach (var state in new[] { StatusValidacaoRpv.PENDENTE, StatusValidacaoRpv.VERIFICADO, StatusValidacaoRpv.REJEITADO })
        {
            await SetStateAsync(rpvId, state, state == StatusValidacaoRpv.PENDENTE ? null : DateTimeOffset.UtcNow);
            var json = await admin.GetStringAsync($"/api/admin/validacoes-rpv/{rpvId}");
            var detail = JsonSerializer.Deserialize<RpvValidationDetailResponse>(json, ApiFactory.JsonOptions)!;
            Assert.Equal(rpvId, detail.FormacaoId);
            Assert.Equal("Maria Silva", detail.Aluno.NomeCompleto);
            Assert.Equal("Rio Pomba", detail.Aluno.Cidade);
            Assert.Equal("MG", detail.Aluno.Uf);
            Assert.Equal(state, detail.Formacao.StatusValidacaoRpv);
            Assert.True(detail.Formacao.EhRioPombaValley);
            Assert.True(detail.Formacao.PossuiCertificado);
            Assert.DoesNotContain("storageKey", json, StringComparison.OrdinalIgnoreCase);
        }

        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/admin/validacoes-rpv/{nonRpvId}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/admin/validacoes-rpv/{Guid.NewGuid()}")).StatusCode);
    }

    [Fact]
    public async Task Certificate_is_streamed_only_to_admin_with_safe_headers_and_name()
    {
        using var admin = await LoginAsync("admin@example.test", AppRoles.Admin);
        var studentId = await factory.CreateUserAsync("student@example.test");
        var recruiterEmail = "recruiter@example.test";
        await factory.CreateUserAsync(recruiterEmail, AppRoles.Recruiter);
        var formationId = await SeedFormationAsync(studentId, StatusValidacaoRpv.PENDENTE, physicalCertificate: true);

        var response = await admin.GetAsync($"/api/admin/validacoes-rpv/{formationId}/certificado");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("application/pdf", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("certificado.pdf", response.Content.Headers.ContentDisposition!.FileNameStar);
        Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
        Assert.Equal(Pdf, await response.Content.ReadAsByteArrayAsync());

        using var anonymous = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync($"/api/admin/validacoes-rpv/{formationId}/certificado")).StatusCode);
        using var student = await LoginAsync("student@example.test", AppRoles.Student, create: false);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await student.GetAsync($"/api/admin/validacoes-rpv/{formationId}/certificado")).StatusCode);
        using var recruiter = await LoginAsync(recruiterEmail, AppRoles.Recruiter, create: false);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await recruiter.GetAsync($"/api/admin/validacoes-rpv/{formationId}/certificado")).StatusCode);
    }

    [Fact]
    public async Task Certificate_returns_404_for_missing_reference_file_non_RPV_and_unknown()
    {
        using var admin = await LoginAsync("admin@example.test", AppRoles.Admin);
        var studentId = await factory.CreateUserAsync("student@example.test");
        var withoutCertificate = await SeedFormationAsync(studentId, StatusValidacaoRpv.PENDENTE);
        var missingPhysical = await SeedFormationAsync(studentId, StatusValidacaoRpv.PENDENTE, databaseCertificate: true);
        var nonRpv = await SeedFormationAsync(studentId, null, rpv: false);

        foreach (var id in new[] { withoutCertificate, missingPhysical, nonRpv, Guid.NewGuid() })
            Assert.Equal(HttpStatusCode.NotFound,
                (await admin.GetAsync($"/api/admin/validacoes-rpv/{id}/certificado")).StatusCode);
    }

    [Fact]
    public async Task Approval_is_atomic_audited_removes_queue_item_and_preserves_profile_timestamps()
    {
        using var admin = await LoginAsync("admin@example.test", AppRoles.Admin);
        var studentId = await factory.CreateUserAsync("student@example.test");
        var formationId = await SeedFormationAsync(studentId, StatusValidacaoRpv.PENDENTE, physicalCertificate: true);
        var before = await TimestampsAsync(formationId);

        Assert.Equal(HttpStatusCode.NoContent,
            (await admin.PostAsync($"/api/admin/validacoes-rpv/{formationId}/aprovar", null)).StatusCode);

        await AssertTransitionAsync(formationId, StatusValidacaoRpv.VERIFICADO,
            AcaoAuditoria.FORMACAO_RPV_APROVADA, "admin@example.test", before, validated: true);
        Assert.DoesNotContain(formationId,
            (await admin.GetFromJsonAsync<PaginatedResponse<RpvValidationListItem>>(
                "/api/admin/validacoes-rpv", ApiFactory.JsonOptions))!.Items.Select(x => x.FormacaoId));
        await AssertStudentStatusAsync("student@example.test", formationId, StatusValidacaoRpv.VERIFICADO);

        Assert.Equal(HttpStatusCode.Conflict,
            (await admin.PostAsync($"/api/admin/validacoes-rpv/{formationId}/aprovar", null)).StatusCode);
        await factory.InScopeAsync(async provider =>
            Assert.Single(await provider.GetRequiredService<AppDbContext>().Auditorias.ToListAsync()));
    }

    [Fact]
    public async Task Approval_requires_database_and_physical_certificate_without_mutation_or_audit()
    {
        using var admin = await LoginAsync("admin@example.test", AppRoles.Admin);
        var studentId = await factory.CreateUserAsync("student@example.test");
        var noReference = await SeedFormationAsync(studentId, StatusValidacaoRpv.PENDENTE);
        var missingPhysical = await SeedFormationAsync(studentId, StatusValidacaoRpv.PENDENTE, databaseCertificate: true);

        foreach (var id in new[] { noReference, missingPhysical })
        {
            var before = await TimestampsAsync(id);
            var response = await admin.PostAsync($"/api/admin/validacoes-rpv/{id}/aprovar", null);
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.DoesNotContain("00000000000000000000000000000000.pdf", await response.Content.ReadAsStringAsync());
            await AssertUnchangedAsync(id, StatusValidacaoRpv.PENDENTE, before);
        }
        await factory.InScopeAsync(async provider =>
            Assert.Empty(await provider.GetRequiredService<AppDbContext>().Auditorias.ToListAsync()));
    }

    [Fact]
    public async Task Rejection_does_not_require_a_certificate()
    {
        using var admin = await LoginAsync("admin@example.test", AppRoles.Admin);
        var studentId = await factory.CreateUserAsync("student@example.test");
        var id = await SeedFormationAsync(studentId, StatusValidacaoRpv.PENDENTE);

        Assert.Equal(HttpStatusCode.NoContent,
            (await admin.PostAsync($"/api/admin/validacoes-rpv/{id}/rejeitar", null)).StatusCode);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.Equal(StatusValidacaoRpv.REJEITADO,
                (await db.Formacoes.AsNoTracking().SingleAsync(x => x.Id == id)).StatusValidacaoRpv);
            Assert.Equal(AcaoAuditoria.FORMACAO_RPV_REJEITADA,
                (await db.Auditorias.AsNoTracking().SingleAsync()).Acao);
        });
    }

    [Theory]
    [InlineData("aprovar")]
    [InlineData("rejeitar")]
    [InlineData("remover-validacao")]
    public async Task Mutations_hide_non_RPV_and_unknown_formations(string action)
    {
        using var admin = await LoginAsync("admin@example.test", AppRoles.Admin);
        var studentId = await factory.CreateUserAsync("student@example.test");
        var nonRpv = await SeedFormationAsync(studentId, null, rpv: false);

        Assert.Equal(HttpStatusCode.NotFound,
            (await admin.PostAsync($"/api/admin/validacoes-rpv/{nonRpv}/{action}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await admin.PostAsync($"/api/admin/validacoes-rpv/{Guid.NewGuid()}/{action}", null)).StatusCode);
        await factory.InScopeAsync(async provider =>
            Assert.Empty(await provider.GetRequiredService<AppDbContext>().Auditorias.ToListAsync()));
    }

    [Fact]
    public async Task Reject_and_remove_validation_follow_state_machine_audit_and_queue_rules()
    {
        using var admin = await LoginAsync("admin@example.test", AppRoles.Admin);
        var studentId = await factory.CreateUserAsync("student@example.test");
        var formationId = await SeedFormationAsync(studentId, StatusValidacaoRpv.PENDENTE, physicalCertificate: true);
        var beforeReject = await TimestampsAsync(formationId);

        Assert.Equal(HttpStatusCode.NoContent,
            (await admin.PostAsync($"/api/admin/validacoes-rpv/{formationId}/rejeitar", null)).StatusCode);
        await AssertTransitionAsync(formationId, StatusValidacaoRpv.REJEITADO,
            AcaoAuditoria.FORMACAO_RPV_REJEITADA, "admin@example.test", beforeReject, validated: true);
        await AssertStudentStatusAsync("student@example.test", formationId, StatusValidacaoRpv.REJEITADO);
        Assert.Equal(HttpStatusCode.Conflict,
            (await admin.PostAsync($"/api/admin/validacoes-rpv/{formationId}/remover-validacao", null)).StatusCode);

        await SetStateAsync(formationId, StatusValidacaoRpv.VERIFICADO, DateTimeOffset.UtcNow);
        var beforeRemove = await TimestampsAsync(formationId);
        Assert.Equal(HttpStatusCode.NoContent,
            (await admin.PostAsync($"/api/admin/validacoes-rpv/{formationId}/remover-validacao", null)).StatusCode);
        await AssertTransitionAsync(formationId, StatusValidacaoRpv.PENDENTE,
            AcaoAuditoria.FORMACAO_RPV_VALIDACAO_REMOVIDA, "admin@example.test", beforeRemove, validated: false,
            expectedAuditCount: 2);
        Assert.Contains(formationId,
            (await admin.GetFromJsonAsync<PaginatedResponse<RpvValidationListItem>>(
                "/api/admin/validacoes-rpv", ApiFactory.JsonOptions))!.Items.Select(x => x.FormacaoId));
        await AssertStudentStatusAsync("student@example.test", formationId, StatusValidacaoRpv.PENDENTE);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.NotNull((await db.Formacoes.SingleAsync(x => x.Id == formationId)).CertificadoStorageKey);
        });
    }

    [Theory]
    [InlineData(StatusValidacaoRpv.VERIFICADO, "aprovar")]
    [InlineData(StatusValidacaoRpv.REJEITADO, "aprovar")]
    [InlineData(StatusValidacaoRpv.VERIFICADO, "rejeitar")]
    [InlineData(StatusValidacaoRpv.REJEITADO, "rejeitar")]
    [InlineData(StatusValidacaoRpv.PENDENTE, "remover-validacao")]
    [InlineData(StatusValidacaoRpv.REJEITADO, "remover-validacao")]
    public async Task Invalid_transitions_return_conflict_without_audit(StatusValidacaoRpv state, string action)
    {
        using var admin = await LoginAsync("admin@example.test", AppRoles.Admin);
        var studentId = await factory.CreateUserAsync("student@example.test");
        var id = await SeedFormationAsync(studentId, state, physicalCertificate: true);
        var before = await TimestampsAsync(id);

        Assert.Equal(HttpStatusCode.Conflict,
            (await admin.PostAsync($"/api/admin/validacoes-rpv/{id}/{action}", null)).StatusCode);
        await AssertUnchangedAsync(id, state, before);
        await factory.InScopeAsync(async provider =>
            Assert.Empty(await provider.GetRequiredService<AppDbContext>().Auditorias.ToListAsync()));
    }

    [Fact]
    public async Task Audit_insert_failure_rolls_back_validation_transition()
    {
        using var admin = await LoginAsync("admin@example.test", AppRoles.Admin);
        var studentId = await factory.CreateUserAsync("student@example.test");
        var id = await SeedFormationAsync(studentId, StatusValidacaoRpv.PENDENTE, physicalCertificate: true);
        var before = await TimestampsAsync(id);
        await factory.InScopeAsync(async provider => await provider.GetRequiredService<AppDbContext>().Database.ExecuteSqlRawAsync(
            "CREATE TRIGGER fail_rpv_audit BEFORE INSERT ON Auditorias BEGIN SELECT RAISE(ABORT, 'test failure'); END;"));

        Assert.Equal(HttpStatusCode.InternalServerError,
            (await admin.PostAsync($"/api/admin/validacoes-rpv/{id}/aprovar", null)).StatusCode);
        await AssertUnchangedAsync(id, StatusValidacaoRpv.PENDENTE, before);
        await factory.InScopeAsync(async provider =>
            Assert.Empty(await provider.GetRequiredService<AppDbContext>().Auditorias.ToListAsync()));
    }

    [Fact]
    public async Task Competing_admin_transitions_have_exactly_one_winner_and_one_audit()
    {
        using var approver = await LoginAsync("admin-a@example.test", AppRoles.Admin);
        using var rejector = await LoginAsync("admin-b@example.test", AppRoles.Admin);
        var studentId = await factory.CreateUserAsync("student@example.test");
        var id = await SeedFormationAsync(studentId, StatusValidacaoRpv.PENDENTE, physicalCertificate: true);

        var responses = await Task.WhenAll(
            approver.PostAsync($"/api/admin/validacoes-rpv/{id}/aprovar", null),
            rejector.PostAsync($"/api/admin/validacoes-rpv/{id}/rejeitar", null));

        Assert.Single(responses, x => x.StatusCode == HttpStatusCode.NoContent);
        Assert.Single(responses, x => x.StatusCode == HttpStatusCode.Conflict);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var formation = await db.Formacoes.AsNoTracking().SingleAsync(x => x.Id == id);
            Assert.True(formation.StatusValidacaoRpv is
                StatusValidacaoRpv.VERIFICADO or StatusValidacaoRpv.REJEITADO);
            var entry = Assert.Single(await db.Auditorias.AsNoTracking().ToListAsync());
            Assert.Equal(formation.StatusValidacaoRpv == StatusValidacaoRpv.VERIFICADO
                ? AcaoAuditoria.FORMACAO_RPV_APROVADA
                : AcaoAuditoria.FORMACAO_RPV_REJEITADA, entry.Acao);
        });
    }

    private async Task<HttpClient> LoginAsync(string email, string role, bool create = true)
    {
        if (create) await factory.CreateUserAsync(email, role);
        var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, email)).StatusCode);
        await ApiFactory.SetCsrfAsync(client);
        return client;
    }

    private async Task<Guid> SeedFormationAsync(
        Guid studentId,
        StatusValidacaoRpv? state,
        bool physicalCertificate = false,
        bool databaseCertificate = false,
        bool rpv = true)
    {
        var id = Guid.NewGuid();
        await factory.InScopeAsync(async provider =>
        {
            string? key = null;
            if (physicalCertificate)
                key = await provider.GetRequiredService<IFileStorage>().StoreAsync(
                    FileCategory.Certificate, new MemoryStream(Pdf), ".pdf");
            else if (databaseCertificate)
                key = "00000000000000000000000000000000.pdf";
            provider.GetRequiredService<AppDbContext>().Formacoes.Add(Formation(id, studentId, state,
                certificateKey: key, rpv: rpv));
            await provider.GetRequiredService<AppDbContext>().SaveChangesAsync();
        });
        return id;
    }

    private static Formacao Formation(
        Guid id,
        Guid studentId,
        StatusValidacaoRpv? state,
        DateTimeOffset? updatedAt = null,
        string? certificateKey = null,
        bool rpv = true) => new()
    {
        Id = id,
        AlunoId = studentId,
        Tipo = TipoFormacao.TECNICO,
        Nome = "Técnico em Desenvolvimento de Sistemas",
        NomeBusca = "tecnico em desenvolvimento de sistemas",
        Instituicao = "Instituto Federal",
        DataInicio = new DateOnly(2025, 2, 1),
        DataFim = new DateOnly(2026, 2, 1),
        CargaHoraria = 1200,
        Status = StatusFormacao.CONCLUIDO,
        Principal = false,
        EhRioPombaValley = rpv,
        StatusValidacaoRpv = state,
        CertificadoStorageKey = certificateKey,
        CriadoEm = updatedAt ?? DateTimeOffset.UtcNow,
        AtualizadoEm = updatedAt ?? DateTimeOffset.UtcNow,
        ValidadoEm = state is StatusValidacaoRpv.VERIFICADO or StatusValidacaoRpv.REJEITADO
            ? DateTimeOffset.UtcNow
            : null
    };

    private async Task SetStudentAsync(
        Guid id,
        string name,
        string normalizedName,
        string slug,
        bool active,
        string? city,
        string? uf) => await factory.InScopeAsync(async provider =>
    {
        var db = provider.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync(x => x.Id == id);
        var student = await db.Alunos.SingleAsync(x => x.UserId == id);
        user.NomeCompleto = name;
        user.NomeBusca = normalizedName;
        student.Slug = slug;
        student.Ativo = active;
        student.Cidade = city;
        student.Uf = uf;
        await db.SaveChangesAsync();
    });

    private async Task SetStateAsync(Guid id, StatusValidacaoRpv state, DateTimeOffset? validatedAt) =>
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var formation = await db.Formacoes.SingleAsync(x => x.Id == id);
            formation.StatusValidacaoRpv = state;
            formation.ValidadoEm = validatedAt;
            await db.SaveChangesAsync();
        });

    private async Task<(DateTimeOffset Student, DateTimeOffset Formation, DateTimeOffset? Validated)> TimestampsAsync(Guid id)
    {
        (DateTimeOffset Student, DateTimeOffset Formation, DateTimeOffset? Validated) result = default;
        await factory.InScopeAsync(async provider =>
        {
            var formation = await provider.GetRequiredService<AppDbContext>().Formacoes.AsNoTracking()
                .Include(x => x.Aluno).SingleAsync(x => x.Id == id);
            result = (formation.Aluno.AtualizadoEm, formation.AtualizadoEm, formation.ValidadoEm);
        });
        return result;
    }

    private async Task AssertTransitionAsync(
        Guid id,
        StatusValidacaoRpv expected,
        AcaoAuditoria action,
        string adminEmail,
        (DateTimeOffset Student, DateTimeOffset Formation, DateTimeOffset? Validated) before,
        bool validated,
        int expectedAuditCount = 1) => await factory.InScopeAsync(async provider =>
    {
        var db = provider.GetRequiredService<AppDbContext>();
        var formation = await db.Formacoes.AsNoTracking().Include(x => x.Aluno).SingleAsync(x => x.Id == id);
        Assert.Equal(expected, formation.StatusValidacaoRpv);
        Assert.Equal(before.Student, formation.Aluno.AtualizadoEm);
        Assert.Equal(before.Formation, formation.AtualizadoEm);
        if (validated) Assert.NotNull(formation.ValidadoEm);
        else Assert.Null(formation.ValidadoEm);
        var entries = await db.Auditorias.AsNoTracking().OrderBy(x => x.CriadoEm).ToListAsync();
        Assert.Equal(expectedAuditCount, entries.Count);
        var entry = entries[^1];
        Assert.Equal(action, entry.Acao);
        Assert.Equal(adminEmail, entry.AdminEmailSnapshot);
        Assert.Equal("FORMACAO", entry.EntidadeTipo);
        Assert.Equal(id.ToString(), entry.EntidadeId);
        Assert.NotNull(entry.AdminUserId);
        Assert.False(string.IsNullOrWhiteSpace(entry.Descricao));
        Assert.InRange(entry.CriadoEm, DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow);
    });

    private async Task AssertUnchangedAsync(
        Guid id,
        StatusValidacaoRpv expected,
        (DateTimeOffset Student, DateTimeOffset Formation, DateTimeOffset? Validated) before) =>
        await factory.InScopeAsync(async provider =>
        {
            var formation = await provider.GetRequiredService<AppDbContext>().Formacoes.AsNoTracking()
                .Include(x => x.Aluno).SingleAsync(x => x.Id == id);
            Assert.Equal(expected, formation.StatusValidacaoRpv);
            Assert.Equal(before.Student, formation.Aluno.AtualizadoEm);
            Assert.Equal(before.Formation, formation.AtualizadoEm);
            Assert.Equal(before.Validated, formation.ValidadoEm);
        });

    private async Task AssertStudentStatusAsync(string email, Guid id, StatusValidacaoRpv expected)
    {
        using var student = await LoginAsync(email, AppRoles.Student, create: false);
        var profile = await student.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions);
        var formations = await student.GetFromJsonAsync<IReadOnlyCollection<FormacaoResponse>>(
            "/api/alunos/me/formacoes", ApiFactory.JsonOptions);
        Assert.Equal(expected, profile!.Formacoes.Single(x => x.Id == id).StatusValidacaoRpv);
        Assert.Equal(expected, formations!.Single(x => x.Id == id).StatusValidacaoRpv);
    }

    public void Dispose() => factory.Dispose();
}
