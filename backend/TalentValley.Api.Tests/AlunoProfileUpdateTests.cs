using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Data;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class AlunoProfileUpdateTests : IDisposable
{
    private readonly ApiFactory factory = new();

    private async Task<(HttpClient Client, Guid Id)> StudentWithIdAsync(string email = "aluno@example.test")
    {
        var id = await factory.CreateUserAsync(email);
        var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        return (client, id);
    }

    private async Task<HttpClient> StudentClientAsync(string email = "aluno@example.test")
    {
        await factory.CreateUserAsync(email);
        var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        return client;
    }

    [Fact]
    public async Task UpdateDadosBasicos_valid_persists()
    {
        var (client, id) = await StudentWithIdAsync();
        var response = await client.PutAsJsonAsync("/api/alunos/me/dados-basicos", new
        {
            nomeCompleto = "João da Silva",
            cidade = "Leopoldina",
            uf = "MG"
        });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var aluno = await db.Alunos.Include(x => x.User).SingleAsync(x => x.UserId == id);
            Assert.Equal("João da Silva", aluno.User.NomeCompleto);
            Assert.Equal("joao da silva", aluno.User.NomeBusca);
            Assert.Equal("Leopoldina", aluno.Cidade);
            Assert.Equal("MG", aluno.Uf);
        });
    }

    [Fact]
    public async Task UpdateDadosBasicos_name_does_not_change_slug()
    {
        var (client, id) = await StudentWithIdAsync();
        string slugBefore = string.Empty;
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            slugBefore = (await db.Alunos.SingleAsync(x => x.UserId == id)).Slug;
        });
        await client.PutAsJsonAsync("/api/alunos/me/dados-basicos", new
        {
            nomeCompleto = "Nome Totalmente Diferente",
            cidade = "Cidade",
            uf = "RJ"
        });
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.Equal(slugBefore, (await db.Alunos.SingleAsync(x => x.UserId == id)).Slug);
        });
    }

    [Fact]
    public async Task UpdateDadosBasicos_uf_becomes_uppercase()
    {
        var (client, id) = await StudentWithIdAsync();
        await client.PutAsJsonAsync("/api/alunos/me/dados-basicos", new
        {
            nomeCompleto = "João Silva",
            cidade = "Leopoldina",
            uf = "mg"
        });
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.Equal("MG", (await db.Alunos.SingleAsync(x => x.UserId == id)).Uf);
        });
    }

    [Fact]
    public async Task UpdateDadosBasicos_invalid_uf_rejected()
    {
        using var client = await StudentClientAsync();
        var response = await client.PutAsJsonAsync("/api/alunos/me/dados-basicos", new
        {
            nomeCompleto = "João Silva",
            cidade = "Leopoldina",
            uf = "MGX"
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateDadosBasicos_atualizadoEm_changes_on_real_mutation()
    {
        var (client, id) = await StudentWithIdAsync();
        DateTimeOffset before = DateTimeOffset.MinValue;
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            before = (await db.Alunos.SingleAsync(x => x.UserId == id)).AtualizadoEm;
        });
        await Task.Delay(10);
        await client.PutAsJsonAsync("/api/alunos/me/dados-basicos", new
        {
            nomeCompleto = "Novo Nome",
            cidade = "Nova Cidade",
            uf = "SP"
        });
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var after = (await db.Alunos.SingleAsync(x => x.UserId == id)).AtualizadoEm;
            Assert.True(after > before);
        });
    }

    public void Dispose() => factory.Dispose();
}
