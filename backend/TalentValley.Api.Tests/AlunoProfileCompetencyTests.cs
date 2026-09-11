using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Data;
using TalentValley.Api.DTOs;

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
        Assert.True(items!.Count >= 13);
    }

    [Fact]
    public async Task Competencias_search_works()
    {
        using var client = await StudentClientAsync();
        var items = await client.GetFromJsonAsync<List<CatalogoCompetenciaResponse>>("/api/competencias?search=react");
        Assert.NotNull(items);
        Assert.Single(items!);
        Assert.Equal("React", items[0].Nome);
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
