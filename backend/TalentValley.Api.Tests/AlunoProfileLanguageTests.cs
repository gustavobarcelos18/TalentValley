using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Data;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class AlunoProfileLanguageTests : IDisposable
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
    public async Task Idiomas_catalog_returned()
    {
        using var client = await StudentClientAsync();
        var items = await client.GetFromJsonAsync<List<CatalogoIdiomaResponse>>("/api/idiomas");
        Assert.NotNull(items);
        Assert.Equal(5, items!.Count);
    }

    [Fact]
    public async Task UpdateIdiomas_valid_levels_work()
    {
        using var client = await StudentClientAsync();
        var catalog = await client.GetFromJsonAsync<List<CatalogoIdiomaResponse>>("/api/idiomas");
        var response = await client.PutAsJsonAsync("/api/alunos/me/idiomas", new
        {
            idiomas = new[]
            {
                new { idiomaId = catalog![0].Id, nivel = "NATIVO" },
                new { idiomaId = catalog[1].Id, nivel = "INTERMEDIARIO" }
            }
        });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var profile = await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions);
        Assert.Equal(2, profile!.Idiomas.Count);
    }

    [Fact]
    public async Task UpdateIdiomas_unknown_language_rejected()
    {
        using var client = await StudentClientAsync();
        var response = await client.PutAsJsonAsync("/api/alunos/me/idiomas", new
        {
            idiomas = new[] { new { idiomaId = 99999, nivel = "BASICO" } }
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateIdiomas_duplicate_language_rejected()
    {
        using var client = await StudentClientAsync();
        var catalog = await client.GetFromJsonAsync<List<CatalogoIdiomaResponse>>("/api/idiomas");
        var id = catalog!.First().Id;
        var response = await client.PutAsJsonAsync("/api/alunos/me/idiomas", new
        {
            idiomas = new[]
            {
                new { idiomaId = id, nivel = "BASICO" },
                new { idiomaId = id, nivel = "AVANCADO" }
            }
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateIdiomas_enum_serialized_as_string()
    {
        using var client = await StudentClientAsync();
        var catalog = await client.GetFromJsonAsync<List<CatalogoIdiomaResponse>>("/api/idiomas");
        await client.PutAsJsonAsync("/api/alunos/me/idiomas", new
        {
            idiomas = new[] { new { idiomaId = catalog![0].Id, nivel = "FLUENTE" } }
        });
        var json = await client.GetStringAsync("/api/alunos/me");
        Assert.Contains("\"nivel\":\"FLUENTE\"", json);
    }

    public void Dispose() => factory.Dispose();
}
