using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class AlunoProfileTests : IDisposable
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

    private async Task<(HttpClient Client, Guid Id)> StudentWithIdAsync(string email = "aluno@example.test")
    {
        var id = await factory.CreateUserAsync(email);
        var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        return (client, id);
    }

    [Fact]
    public async Task Anonymous_me_returns_401()
    {
        using var client = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/alunos/me")).StatusCode);
    }

    [Theory]
    [InlineData(AppRoles.Recruiter)]
    [InlineData(AppRoles.Admin)]
    public async Task Non_student_me_returns_403(string role)
    {
        await factory.CreateUserAsync("person@example.test", role);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "person@example.test");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/alunos/me")).StatusCode);
    }

    [Fact]
    public async Task Active_student_me_returns_200()
    {
        using var client = await StudentClientAsync();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/alunos/me")).StatusCode);
    }

    [Fact]
    public async Task Blocked_student_me_returns_403()
    {
        var (client, id) = await StudentWithIdAsync();
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            (await db.Alunos.SingleAsync(x => x.UserId == id)).Ativo = false;
            await db.SaveChangesAsync();
        });
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/alunos/me")).StatusCode);
    }

    [Fact]
    public async Task Mutation_without_csrf_returns_400()
    {
        await factory.CreateUserAsync("aluno@example.test");
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "aluno@example.test");
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        var response = await client.PutAsJsonAsync("/api/alunos/me/dados-basicos", new
        {
            nomeCompleto = "João Silva",
            cidade = "Leopoldina",
            uf = "MG"
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetProfile_returns_own_profile()
    {
        var (client, id) = await StudentWithIdAsync();
        var profile = await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions);
        Assert.NotNull(profile);
        Assert.Equal(id, profile!.Id);
        Assert.Equal("Maria Álvares", profile.DadosBasicos.NomeCompleto);
        Assert.Null(profile.DadosBasicos.FotoUrl);
        Assert.NotNull(profile.Curriculo);
        Assert.False(profile.Curriculo.PossuiCurriculo);
        Assert.Null(profile.Curriculo.NomeArquivo);
    }

    [Fact]
    public async Task GetProfile_never_exposes_storage_keys_or_internal_fields()
    {
        using var client = await StudentClientAsync();
        var json = await client.GetStringAsync("/api/alunos/me");
        Assert.DoesNotContain("FotoStorageKey", json);
        Assert.DoesNotContain("CurriculoStorageKey", json);
        Assert.DoesNotContain("UserId", json);
        Assert.DoesNotContain("Normalized", json);
    }

    [Fact]
    public async Task GetProfile_does_not_return_other_student_data()
    {
        await factory.CreateUserAsync("other@example.test");
        using var client = await StudentClientAsync("first@example.test");
        var profile = await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions);
        Assert.NotNull(profile);
        Assert.Equal("Maria Álvares", profile!.DadosBasicos.NomeCompleto);
    }

    public void Dispose() => factory.Dispose();
}
