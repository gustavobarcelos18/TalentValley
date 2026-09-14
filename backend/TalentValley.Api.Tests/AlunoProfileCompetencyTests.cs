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

public sealed class AlunoProfileCompetencyTests : IDisposable
{
    private readonly ApiFactory factory = new();

    private async Task<HttpClient> StudentClientAsync(string email = "aluno@example.test")
    {
        await factory.CreateUserAsync(email);
        var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        return client;
    }

    [Fact]
    public async Task Competencias_catalog_returned()
    {
        using var client = await StudentClientAsync();
        var items = await client.GetFromJsonAsync<List<CatalogoCompetenciaResponse>>("/api/competencias");
        Assert.NotNull(items);
        Assert.Equal(CatalogSeedService.CompetenciaNames.Length, items!.Count);
    }

    [Fact]
    public async Task Competencias_catalog_seed_is_complete_idempotent_and_preserves_existing_records()
    {
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var seed = provider.GetRequiredService<CatalogSeedService>();
            var existing = new Competencia
            {
                Nome = "Existing competency", NomeBusca = NameNormalizer.Normalize("Existing competency")
            };
            db.Competencias.Add(existing);
            await db.SaveChangesAsync();
            var existingId = existing.Id;

            await seed.InitializeAsync();
            var countAfterFirstRun = await db.Competencias.CountAsync();
            await seed.InitializeAsync();

            Assert.Equal(countAfterFirstRun, await db.Competencias.CountAsync());
            Assert.Equal(existingId, (await db.Competencias.SingleAsync(x => x.Nome == existing.Nome)).Id);
            var configured = await db.Competencias.Select(x => x.NomeBusca).ToListAsync();
            Assert.All(CatalogSeedService.CompetenciaNames,
                name => Assert.Contains(NameNormalizer.Normalize(name), configured));
        });
    }

    [Fact]
    public void Configured_competency_names_have_unique_normalized_search_keys()
    {
        var normalized = CatalogSeedService.CompetenciaNames.Select(NameNormalizer.Normalize).ToList();

        Assert.Equal(normalized.Count, normalized.Distinct().Count());
    }

    [Fact]
    public async Task Competencias_catalog_contains_representative_categories()
    {
        using var client = await StudentClientAsync();
        var items = (await client.GetFromJsonAsync<List<CatalogoCompetenciaResponse>>("/api/competencias"))!;
        var names = items.Select(x => x.Nome).ToHashSet();

        var required = new[]
        {
            "C#", "ASP.NET Core", "React", "PostgreSQL", "Docker", "GitHub Actions", "xUnit",
            "Machine Learning", "Flutter", "Clean Architecture", "OWASP", "Figma"
        };
        Assert.All(required, name => Assert.Contains(name, names));
    }

    [Fact]
    public async Task Competencias_search_works()
    {
        using var client = await StudentClientAsync();
        var items = await client.GetFromJsonAsync<List<CatalogoCompetenciaResponse>>("/api/competencias?search=react");
        Assert.NotNull(items);
        Assert.Contains(items!, item => item.Nome == "React");
    }

    [Fact]
    public async Task Competencias_search_is_case_insensitive()
    {
        using var client = await StudentClientAsync();
        var items = await client.GetFromJsonAsync<List<CatalogoCompetenciaResponse>>("/api/competencias?search=ReAcT");

        Assert.Contains(items!, item => item.Nome == "React");
    }

    [Fact]
    public async Task Competencias_catalog_requires_authentication()
    {
        using var client = factory.Client();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/competencias")).StatusCode);
    }

    [Fact]
    public async Task Active_recruiter_can_read_and_search_competency_catalog()
    {
        await factory.CreateUserAsync("recruiter@example.test", AppRoles.Recruiter);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "recruiter@example.test");

        var catalogResponse = await client.GetAsync("/api/competencias");
        Assert.Equal(HttpStatusCode.OK, catalogResponse.StatusCode);
        var items = await catalogResponse.Content.ReadFromJsonAsync<List<CatalogoCompetenciaResponse>>();
        Assert.NotNull(items);
        Assert.Equal(CatalogSeedService.CompetenciaNames.Length, items!.Count);

        var searchResponse = await client.GetAsync("/api/competencias?search=react");
        Assert.Equal(HttpStatusCode.OK, searchResponse.StatusCode);
        var matches = await searchResponse.Content.ReadFromJsonAsync<List<CatalogoCompetenciaResponse>>();
        Assert.Contains(matches!, item => item.Nome == "React");
    }

    [Theory]
    [InlineData(AppRoles.Student)]
    [InlineData(AppRoles.Recruiter)]
    public async Task Blocked_account_cannot_read_competency_catalog(string role)
    {
        const string email = "blocked@example.test";
        var id = await factory.CreateUserAsync(email, role);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);

        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            if (role == AppRoles.Student) (await db.Alunos.SingleAsync(x => x.UserId == id)).Ativo = false;
            else (await db.Recrutadores.SingleAsync(x => x.UserId == id)).Status = StatusRecrutador.BLOQUEADO;
            await db.SaveChangesAsync();
        });

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/competencias")).StatusCode);
    }

    [Fact]
    public async Task Admin_cannot_read_competency_catalog()
    {
        await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "admin@example.test");

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/competencias")).StatusCode);
    }

    [Fact]
    public async Task UpdateCompetencias_full_replacement_works()
    {
        using var client = await StudentClientAsync();
        var catalog = await client.GetFromJsonAsync<List<CatalogoCompetenciaResponse>>("/api/competencias");
        var ids = catalog!.Take(3).Select(x => x.Id).ToList();
        var response = await client.PutAsJsonAsync("/api/alunos/me/competencias", new { competenciaIds = ids });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var profile = await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions);
        Assert.Equal(ids.OrderBy(x => x), profile!.Competencias.Select(x => x.Id).OrderBy(x => x));
    }

    [Fact]
    public async Task UpdateCompetencias_unknown_id_rejected()
    {
        using var client = await StudentClientAsync();
        var response = await client.PutAsJsonAsync("/api/alunos/me/competencias", new { competenciaIds = new[] { 99999 } });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateCompetencias_duplicates_normalized()
    {
        using var client = await StudentClientAsync();
        var catalog = await client.GetFromJsonAsync<List<CatalogoCompetenciaResponse>>("/api/competencias");
        var id = catalog!.First().Id;
        var response = await client.PutAsJsonAsync("/api/alunos/me/competencias", new { competenciaIds = new[] { id, id, id } });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var profile = await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions);
        Assert.Single(profile!.Competencias);
    }

    [Fact]
    public async Task UpdateCompetencias_idempotent_same_state_no_duplicates()
    {
        using var client = await StudentClientAsync();
        var catalog = await client.GetFromJsonAsync<List<CatalogoCompetenciaResponse>>("/api/competencias");
        var ids = catalog!.Take(2).Select(x => x.Id).ToList();
        await client.PutAsJsonAsync("/api/alunos/me/competencias", new { competenciaIds = ids });
        await client.PutAsJsonAsync("/api/alunos/me/competencias", new { competenciaIds = ids });

        var profile = await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions);
        Assert.Equal(2, profile!.Competencias.Count);
    }

    public void Dispose() => factory.Dispose();
}
