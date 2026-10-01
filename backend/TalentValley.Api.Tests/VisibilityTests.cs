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
using TalentValley.Api.Services;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Tests;

public sealed class VisibilityTests : IDisposable
{
    private readonly ApiFactory factory = new();

    [Fact]
    public async Task Unactivated_or_blocked_students_are_hidden_from_every_recruiter_surface()
    {
        var recruiterId = await factory.CreateUserAsync("recruiter@example.test", AppRoles.Recruiter);
        await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        var otherId = await factory.CreateUserAsync("other@example.test");
        // Approved by the admin (Ativo = true) but the activation link was never used.
        var pendingId = await factory.CreateUserAsync("pending@example.test", activated: false);
        Guid formationId = Guid.NewGuid();
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var storage = services.GetRequiredService<IFileStorage>();
            var pdf = "%PDF-1.7 visibility"u8.ToArray();
            (await db.Alunos.SingleAsync(x => x.UserId == otherId)).Slug = "other";
            var pending = await db.Alunos.SingleAsync(x => x.UserId == pendingId);
            pending.Slug = "pending";
            pending.AtualizadoEm = DateTimeOffset.UtcNow;
            pending.FotoStorageKey = await storage.StoreAsync(FileCategory.Photo, new MemoryStream([0xff, 0xd8, 0xff, 0xe0, 7]), ".jpg");
            pending.CurriculoStorageKey = await storage.StoreAsync(FileCategory.Curriculum, new MemoryStream(pdf), ".pdf");
            db.Formacoes.Add(new Formacao
            {
                Id = formationId, AlunoId = pendingId, Tipo = TipoFormacao.CURSO_LIVRE, Nome = "Course",
                NomeBusca = "course", Instituicao = "School",
                CertificadoStorageKey = await storage.StoreAsync(FileCategory.Certificate, new MemoryStream(pdf), ".pdf")
            });
            // Favorite inserted directly: the API itself refuses to favorite a hidden student.
            db.Favoritos.Add(new Favorito { RecrutadorId = recruiterId, AlunoId = pendingId, CriadoEm = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        });

        using var recruiter = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(recruiter, "recruiter@example.test")).StatusCode);
        await SetPreviousLoginAsync(recruiterId);
        await AssertHiddenAsync(recruiter);
        await ApiFactory.SetCsrfAsync(recruiter);
        Assert.Equal(HttpStatusCode.NotFound, (await recruiter.PostAsync("/api/recrutador/favoritos/pending", null)).StatusCode);

        await ActivateAsync("pending@example.test");
        await AssertVisibleAsync(recruiter);

        using var admin = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(admin, "admin@example.test")).StatusCode);
        await ApiFactory.SetCsrfAsync(admin);
        Assert.Equal(HttpStatusCode.NoContent, (await admin.PostAsync($"/api/admin/alunos/{pendingId}/bloquear", null)).StatusCode);
        await AssertHiddenAsync(recruiter);

        Assert.Equal(HttpStatusCode.NoContent, (await admin.DeleteAsync($"/api/admin/alunos/{pendingId}")).StatusCode);
        await AssertHiddenAsync(recruiter);
    }

    private async Task AssertHiddenAsync(HttpClient recruiter)
    {
        var search = await recruiter.GetFromJsonAsync<PaginatedResponse<TalentListItem>>("/api/talentos", ApiFactory.JsonOptions);
        Assert.Equal(["other"], search!.Items.Select(x => x.Slug));
        Assert.Equal(1, search.TotalItems);
        var byName = await recruiter.GetFromJsonAsync<PaginatedResponse<TalentListItem>>("/api/talentos?nome=maria", ApiFactory.JsonOptions);
        Assert.DoesNotContain(byName!.Items, x => x.Slug == "pending");

        var favorites = await recruiter.GetFromJsonAsync<PaginatedResponse<FavoriteTalentResponse>>(
            "/api/recrutador/favoritos", ApiFactory.JsonOptions);
        Assert.Empty(favorites!.Items);
        Assert.Equal(0, favorites.TotalItems);

        var dashboard = await recruiter.GetFromJsonAsync<RecruiterDashboardResponse>("/api/recrutador/dashboard", ApiFactory.JsonOptions);
        Assert.Equal(0, dashboard!.Indicadores.Favoritos);
        Assert.Empty(dashboard.FavoritosRecentes);
        // Only the activated "other" student counts as new/updated.
        Assert.Equal(1, dashboard.Indicadores.NovosAlunosDesdeUltimoAcesso);
        Assert.Equal(1, dashboard.Indicadores.PerfisAtualizadosDesdeUltimoAcesso);

        foreach (var path in new[]
        {
            "/api/talentos/pending", "/api/talentos/pending/foto", "/api/talentos/pending/curriculo",
            $"/api/talentos/pending/formacoes/{await FormationIdAsync()}/certificado",
            "/api/recrutador/comparar?slugs=pending&slugs=other"
        })
            Assert.Equal(HttpStatusCode.NotFound, (await recruiter.GetAsync(path)).StatusCode);
    }

    private async Task AssertVisibleAsync(HttpClient recruiter)
    {
        var search = await recruiter.GetFromJsonAsync<PaginatedResponse<TalentListItem>>("/api/talentos", ApiFactory.JsonOptions);
        Assert.Equal(2, search!.TotalItems);
        Assert.Contains(search.Items, x => x.Slug == "pending");

        var favorites = await recruiter.GetFromJsonAsync<PaginatedResponse<FavoriteTalentResponse>>(
            "/api/recrutador/favoritos", ApiFactory.JsonOptions);
        Assert.Equal("pending", Assert.Single(favorites!.Items).Talento.Slug);

        var dashboard = await recruiter.GetFromJsonAsync<RecruiterDashboardResponse>("/api/recrutador/dashboard", ApiFactory.JsonOptions);
        Assert.Equal(1, dashboard!.Indicadores.Favoritos);
        Assert.Single(dashboard.FavoritosRecentes);
        Assert.Equal(2, dashboard.Indicadores.NovosAlunosDesdeUltimoAcesso);
        Assert.Equal(2, dashboard.Indicadores.PerfisAtualizadosDesdeUltimoAcesso);

        foreach (var path in new[]
        {
            "/api/talentos/pending", "/api/talentos/pending/foto", "/api/talentos/pending/curriculo",
            $"/api/talentos/pending/formacoes/{await FormationIdAsync()}/certificado",
            "/api/recrutador/comparar?slugs=pending&slugs=other"
        })
            Assert.Equal(HttpStatusCode.OK, (await recruiter.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await recruiter.PostAsync("/api/recrutador/favoritos/pending", null)).StatusCode);
    }

    private async Task<Guid> FormationIdAsync()
    {
        Guid id = Guid.Empty;
        await factory.InScopeAsync(async services =>
            id = await services.GetRequiredService<AppDbContext>().Formacoes.Select(x => x.Id).SingleOrDefaultAsync());
        return id == Guid.Empty ? Guid.NewGuid() : id;
    }

    private Task SetPreviousLoginAsync(Guid recruiterId) => factory.InScopeAsync(async services =>
    {
        var db = services.GetRequiredService<AppDbContext>();
        (await db.Users.SingleAsync(x => x.Id == recruiterId)).LoginAnteriorEm = DateTimeOffset.UtcNow.AddDays(-1);
        await db.SaveChangesAsync();
    });

    private async Task ActivateAsync(string email)
    {
        string token = "";
        await factory.InScopeAsync(async services =>
        {
            var user = (await services.GetRequiredService<UserManager<ApplicationUser>>().FindByEmailAsync(email))!;
            token = await services.GetRequiredService<AccountTokenService>().GenerateActivationTokenAsync(user);
        });
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/auth/activate-account",
            new ActivateAccountRequest(email, token, ApiFactory.Password))).StatusCode);
    }

    public void Dispose() => factory.Dispose();
}
