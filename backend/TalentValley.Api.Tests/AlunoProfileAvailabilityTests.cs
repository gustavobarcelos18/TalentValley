using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Data;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Tests;

public sealed class AlunoProfileAvailabilityTests : IDisposable
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

    // The yes/no fields are required by the API, so every payload sends them (all false here).
    private static object Payload(string[] disponibilidades, string[] modalidades) => new
    {
        disponibilidades,
        modalidades,
        disponivelImediatamente = false,
        aceitaViajar = false,
        aceitaMudarDeCidade = false,
        possuiVeiculoProprio = false,
        souPcd = false,
        interesseVagaPcd = false,
        consentimentoPcd = false
    };

    [Fact]
    public async Task UpdateDisponibilidade_full_replacement_works()
    {
        using var client = await StudentClientAsync();
        var response = await client.PutAsJsonAsync("/api/alunos/me/disponibilidade",
            Payload(["ESTAGIO", "CLT"], ["REMOTO", "HIBRIDO"]));
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var profile = await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions);
        Assert.Equal(2, profile!.Disponibilidades.Count);
        Assert.Equal(2, profile.Modalidades.Count);
    }

    [Fact]
    public async Task UpdateDisponibilidade_invalid_enum_returns_400()
    {
        using var client = await StudentClientAsync();
        var response = await client.PutAsJsonAsync("/api/alunos/me/disponibilidade",
            Payload(["INVALID"], ["REMOTO"]));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateDisponibilidade_idempotent_request()
    {
        using var client = await StudentClientAsync();
        var payload = Payload(["PJ", "FREELANCER"], ["PRESENCIAL"]);
        await client.PutAsJsonAsync("/api/alunos/me/disponibilidade", payload);
        var response = await client.PutAsJsonAsync("/api/alunos/me/disponibilidade", payload);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var profile = await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions);
        Assert.Equal(2, profile!.Disponibilidades.Count);
        Assert.Single(profile.Modalidades);
    }

    [Fact]
    public async Task Catalog_seed_is_idempotent()
    {
        using var factory2 = new ApiFactory();
        await factory2.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var competencias = await db.Competencias.OrderBy(x => x.NomeBusca).Select(x => x.Nome).ToListAsync();
            Assert.Equal(CatalogSeedService.CompetenciaNames.Length, competencias.Count);
            Assert.Contains("React", competencias);
            Assert.Contains("Docker", competencias);

            var idiomas = await db.Idiomas.OrderBy(x => x.NomeBusca).Select(x => x.Nome).ToListAsync();
            Assert.Equal(CatalogSeedService.IdiomaNames.Length, idiomas.Count);
            Assert.Contains("Português", idiomas);
            Assert.Contains("Alemão", idiomas);

            Assert.Equal(competencias.Count, await db.Competencias.Select(x => x.NomeBusca).Distinct().CountAsync());
            Assert.Equal(idiomas.Count, await db.Idiomas.Select(x => x.NomeBusca).Distinct().CountAsync());
        });
    }

    public void Dispose() => factory.Dispose();
}
