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
using TalentValley.Api.Storage;

namespace TalentValley.Api.Tests;

// Demonstration accounts must stay on their own side: real recruiters never reach demonstration students,
// the demonstration recruiter never reaches real students, and administrative numbers ignore demo accounts.
public sealed class DemoIsolationTests : IDisposable
{
    private const string RealSlug = "real-aluno";
    private const string DemoSlug = "demo-aluno";
    private const string OtherDemoSlug = "demo-outro";

    private readonly ApiFactory factory = new();

    public void Dispose() => factory.Dispose();

    private static string Email(string prefix) => $"{prefix}-{Guid.NewGuid():N}@example.test";

    private sealed record Setup(Guid RealRecruiter, Guid DemoRecruiter, Guid DemoFormation, string RealRecruiterEmail);

    // Demonstration accounts have no password, so tests create ordinary accounts and mark them as demo.
    private async Task<Setup> SeedAsync()
    {
        var realRecruiterEmail = Email("recruiter");
        var realRecruiter = await factory.CreateUserAsync(realRecruiterEmail, AppRoles.Recruiter);
        var demoRecruiter = await factory.CreateUserAsync(Email("demo-recruiter"), AppRoles.Recruiter);
        var realStudent = await factory.CreateUserAsync(Email("real"));
        var demoStudent = await factory.CreateUserAsync(Email("demo"));
        var otherDemoStudent = await factory.CreateUserAsync(Email("demo-other"));
        var formationId = Guid.NewGuid();
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var storage = services.GetRequiredService<IFileStorage>();
            var pdf = "%PDF-1.7 isolation"u8.ToArray();
            foreach (var (id, slug, demo) in new[]
                     { (realStudent, RealSlug, false), (demoStudent, DemoSlug, true), (otherDemoStudent, OtherDemoSlug, true) })
            {
                var student = await db.Alunos.SingleAsync(x => x.UserId == id);
                student.Slug = slug;
                student.FotoStorageKey = await storage.StoreAsync(
                    FileCategory.Photo, new MemoryStream([0xff, 0xd8, 0xff, 0xe0, 7]), ".jpg");
                student.CurriculoStorageKey = await storage.StoreAsync(FileCategory.Curriculum, new MemoryStream(pdf), ".pdf");
                (await db.Users.SingleAsync(x => x.Id == id)).EhDemo = demo;
            }
            (await db.Users.SingleAsync(x => x.Id == demoRecruiter)).EhDemo = true;
            db.Formacoes.Add(new Formacao
            {
                Id = formationId, AlunoId = demoStudent, Tipo = TipoFormacao.CURSO_LIVRE, Nome = "Course",
                NomeBusca = "course", Instituicao = "School",
                CertificadoStorageKey = await storage.StoreAsync(FileCategory.Certificate, new MemoryStream(pdf), ".pdf")
            });
            // Inserted directly: the API itself refuses a favorite across the demonstration boundary.
            db.Favoritos.Add(new Favorito { RecrutadorId = realRecruiter, AlunoId = demoStudent, CriadoEm = DateTimeOffset.UtcNow });
            db.Favoritos.Add(new Favorito { RecrutadorId = demoRecruiter, AlunoId = realStudent, CriadoEm = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        });
        return new(realRecruiter, demoRecruiter, formationId, realRecruiterEmail);
    }

    private async Task<HttpClient> SignedInAsync(string email)
    {
        var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, email)).StatusCode);
        await ApiFactory.SetCsrfAsync(client);
        return client;
    }

    private async Task<T> InServiceAsync<T>(Func<IServiceProvider, Task<T>> action)
    {
        T result = default!;
        await factory.InScopeAsync(async services => result = await action(services));
        return result;
    }

    [Fact]
    public async Task RealRecruiter_NeverReachesDemoStudents()
    {
        var setup = await SeedAsync();
        using var recruiter = await SignedInAsync(setup.RealRecruiterEmail);
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            (await db.Users.SingleAsync(x => x.Id == setup.RealRecruiter)).LoginAnteriorEm = DateTimeOffset.UtcNow.AddDays(-1);
            await db.SaveChangesAsync();
        });

        var search = await recruiter.GetFromJsonAsync<PaginatedResponse<TalentListItem>>("/api/talentos", ApiFactory.JsonOptions);
        Assert.Equal([RealSlug], search!.Items.Select(x => x.Slug));
        Assert.Equal(1, search.TotalItems);

        foreach (var path in new[]
        {
            $"/api/talentos/{DemoSlug}", $"/api/talentos/{DemoSlug}/foto", $"/api/talentos/{DemoSlug}/curriculo",
            $"/api/talentos/{DemoSlug}/formacoes/{setup.DemoFormation}/certificado",
            $"/api/recrutador/comparar?slugs={RealSlug}&slugs={DemoSlug}"
        })
            Assert.Equal(HttpStatusCode.NotFound, (await recruiter.GetAsync(path)).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await recruiter.PostAsync($"/api/recrutador/favoritos/{DemoSlug}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await recruiter.DeleteAsync($"/api/recrutador/favoritos/{DemoSlug}")).StatusCode);

        var favorites = await recruiter.GetFromJsonAsync<PaginatedResponse<FavoriteTalentResponse>>(
            "/api/recrutador/favoritos", ApiFactory.JsonOptions);
        Assert.Empty(favorites!.Items);
        Assert.Equal(0, favorites.TotalItems);

        var dashboard = await recruiter.GetFromJsonAsync<RecruiterDashboardResponse>("/api/recrutador/dashboard", ApiFactory.JsonOptions);
        Assert.Equal(0, dashboard!.Indicadores.Favoritos);
        Assert.Empty(dashboard.FavoritosRecentes);
        Assert.Equal(1, dashboard.Indicadores.NovosAlunosDesdeUltimoAcesso);
        Assert.Equal(1, dashboard.Indicadores.PerfisAtualizadosDesdeUltimoAcesso);

        Assert.Equal(HttpStatusCode.OK, (await recruiter.GetAsync($"/api/talentos/{RealSlug}")).StatusCode);
    }

    [Fact]
    public async Task DemoRecruiter_OnlyReachesDemoStudents()
    {
        var setup = await SeedAsync();

        var searchPage = await InServiceAsync(async services => await services.GetRequiredService<TalentDiscoveryService>()
            .SearchAsync(setup.DemoRecruiter, new TalentSearchQuery(), CancellationToken.None));
        Assert.Equal([DemoSlug, OtherDemoSlug], searchPage.Items.Select(x => x.Slug).Order());
        Assert.Equal(2, searchPage.TotalItems);

        await factory.InScopeAsync(async services =>
        {
            var talents = services.GetRequiredService<TalentDiscoveryService>();
            Assert.Null(await talents.GetBySlugAsync(setup.DemoRecruiter, RealSlug, CancellationToken.None));
            Assert.NotNull(await talents.GetBySlugAsync(setup.DemoRecruiter, DemoSlug, CancellationToken.None));

            var comparisons = services.GetRequiredService<TalentComparisonService>();
            Assert.Null(await comparisons.CompareAsync(setup.DemoRecruiter, RealSlug, DemoSlug, CancellationToken.None));
            Assert.NotNull(await comparisons.CompareAsync(setup.DemoRecruiter, DemoSlug, OtherDemoSlug, CancellationToken.None));

            var files = services.GetRequiredService<TalentFileService>();
            Assert.Null(await files.OpenPhotoAsync(setup.DemoRecruiter, RealSlug, CancellationToken.None));
            Assert.Null(await files.OpenCurriculumAsync(setup.DemoRecruiter, RealSlug, CancellationToken.None));
            await using (var curriculum = (await files.OpenCurriculumAsync(setup.DemoRecruiter, DemoSlug, CancellationToken.None))?.Content)
                Assert.NotNull(curriculum);
            await using (var photo = (await files.OpenPhotoAsync(setup.DemoRecruiter, DemoSlug, CancellationToken.None))?.Content)
                Assert.NotNull(photo);
            await using (var certificate = (await files.OpenCertificateAsync(
                             setup.DemoRecruiter, DemoSlug, setup.DemoFormation, CancellationToken.None))?.Content)
                Assert.NotNull(certificate);

            var favorites = services.GetRequiredService<FavoriteService>();
            Assert.False(await favorites.AddAsync(setup.DemoRecruiter, RealSlug, CancellationToken.None));
            Assert.False(await favorites.RemoveAsync(setup.DemoRecruiter, RealSlug, CancellationToken.None));
            Assert.True(await favorites.AddAsync(setup.DemoRecruiter, DemoSlug, CancellationToken.None));
            // The stale favorite on a real student (inserted directly) is not listed.
            var listed = await favorites.ListAsync(setup.DemoRecruiter, 1, CancellationToken.None);
            Assert.Equal(DemoSlug, Assert.Single(listed.Items).Talento.Slug);
            Assert.Equal(1, listed.TotalItems);

            var dashboard = await services.GetRequiredService<RecruiterDashboardService>()
                .GetAsync(setup.DemoRecruiter, CancellationToken.None);
            Assert.Equal(1, dashboard.Indicadores.Favoritos);
        });
    }

    [Fact]
    public async Task AdminNumbersAndLists_IgnoreDemoAccounts()
    {
        factory.Overrides["Demo:Enabled"] = "true";
        var adminEmail = Email("admin");
        await factory.CreateUserAsync(adminEmail, AppRoles.Admin);
        var realStudent = await factory.CreateUserAsync(Email("real"));
        await factory.CreateUserAsync(Email("recruiter"), AppRoles.Recruiter);
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            (await db.Alunos.SingleAsync(x => x.UserId == realStudent)).Slug = RealSlug;
            await db.SaveChangesAsync();
        });
        using var admin = await SignedInAsync(adminEmail);

        var before = await admin.GetFromJsonAsync<AdminDashboardResponse>("/api/admin/dashboard", ApiFactory.JsonOptions);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync("/api/admin/demo/preparar", null)).StatusCode);
        var after = await admin.GetFromJsonAsync<AdminDashboardResponse>("/api/admin/dashboard", ApiFactory.JsonOptions);

        Assert.Equal(1, after!.AlunosAtivos);
        Assert.Equal(1, after.RecrutadoresAtivos);
        Assert.Equal(before! with { CompetenciasMaisUtilizadas = [] }, after with { CompetenciasMaisUtilizadas = [] });
        Assert.Equal(before.CompetenciasMaisUtilizadas, after.CompetenciasMaisUtilizadas);

        var students = await admin.GetFromJsonAsync<PaginatedResponse<AlunoListItem>>("/api/admin/alunos", ApiFactory.JsonOptions);
        Assert.Equal([RealSlug], students!.Items.Select(x => x.Slug));
        var recruiters = await admin.GetFromJsonAsync<PaginatedResponse<RecrutadorListItem>>("/api/admin/recrutadores", ApiFactory.JsonOptions);
        Assert.Equal(1, recruiters!.TotalItems);
        var validations = await admin.GetFromJsonAsync<PaginatedResponse<RpvValidationListItem>>("/api/admin/validacoes-rpv", ApiFactory.JsonOptions);
        Assert.Equal(0, validations!.TotalItems);

        // The prepared demonstration really has pending RPV validations; they just stay out of the admin view.
        var pendingDemoRpv = await InServiceAsync(async services => await services.GetRequiredService<AppDbContext>().Formacoes
            .CountAsync(x => x.Aluno.User.EhDemo && x.EhRioPombaValley && x.StatusValidacaoRpv == StatusValidacaoRpv.PENDENTE));
        Assert.True(pendingDemoRpv > 0);
    }

    [Fact]
    public async Task Audit_KeepsDemoEntriesButDoesNotListThem()
    {
        factory.Overrides["Demo:Enabled"] = "true";
        var adminEmail = Email("admin");
        var adminId = await factory.CreateUserAsync(adminEmail, AppRoles.Admin);
        using var admin = await SignedInAsync(adminEmail);
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            db.Auditorias.Add(new Auditoria
            {
                Id = Guid.NewGuid(), AdminUserId = adminId, AdminEmailSnapshot = adminEmail, Acao = AcaoAuditoria.ALUNO_CRIADO,
                EntidadeTipo = AppRoles.Student, EntidadeId = Guid.NewGuid().ToString(), Descricao = "Aluno criado.",
                CriadoEm = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        });
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync("/api/admin/demo/preparar", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync("/api/admin/demo/restaurar", null)).StatusCode);

        var listed = await admin.GetFromJsonAsync<PaginatedResponse<AuditoriaListItem>>("/api/admin/auditoria", ApiFactory.JsonOptions);
        Assert.Equal([AcaoAuditoria.ALUNO_CRIADO], listed!.Items.Select(x => x.Acao));
        Assert.Equal(1, listed.TotalItems);

        var recorded = await InServiceAsync(async services => await services.GetRequiredService<AppDbContext>().Auditorias
            .Where(x => x.Acao == AcaoAuditoria.DEMO_PREPARADA || x.Acao == AcaoAuditoria.DEMO_RESTAURADA).CountAsync());
        Assert.Equal(2, recorded);
    }
}
