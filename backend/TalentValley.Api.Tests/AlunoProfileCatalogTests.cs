using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Data;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class AlunoProfileCatalogTests : IDisposable
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
    public async Task UpdateSobre_max_1500_accepted()
    {
        using var client = await StudentClientAsync();
        var bio = new string('a', 1500);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync("/api/alunos/me/sobre", new { bio })).StatusCode);
    }

    [Fact]
    public async Task UpdateSobre_over_1500_rejected()
    {
        using var client = await StudentClientAsync();
        var bio = new string('a', 1501);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("/api/alunos/me/sobre", new { bio })).StatusCode);
    }

    [Fact]
    public async Task UpdateSobre_blank_becomes_null()
    {
        var (client, id) = await StudentWithIdAsync();
        await client.PutAsJsonAsync("/api/alunos/me/sobre", new { bio = "Some bio" });
        await client.PutAsJsonAsync("/api/alunos/me/sobre", new { bio = "   " });
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.Null((await db.Alunos.SingleAsync(x => x.UserId == id)).Bio);
        });
    }

    [Fact]
    public async Task UpdateContato_valid_urls_accepted()
    {
        using var client = await StudentClientAsync();
        var response = await client.PutAsJsonAsync("/api/alunos/me/contato", new
        {
            telefone = "(32) 99999-0000",
            emailProfissional = "joao@example.com",
            linkedinUrl = "https://linkedin.com/in/joao",
            githubUrl = "https://github.com/joao",
            portfolioUrl = "https://joao.dev"
        });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task UpdateContato_rejects_an_overlong_phone_instead_of_truncating_it()
    {
        using var client = await StudentClientAsync();

        var response = await client.PutAsJsonAsync("/api/alunos/me/contato", new
        {
            telefone = "553299999000012"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateContato_invalid_scheme_rejected()
    {
        using var client = await StudentClientAsync();
        var response = await client.PutAsJsonAsync("/api/alunos/me/contato", new { linkedinUrl = "javascript:alert(1)" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateContato_data_scheme_rejected()
    {
        using var client = await StudentClientAsync();
        var response = await client.PutAsJsonAsync("/api/alunos/me/contato", new { githubUrl = "data:text/html,<script>alert(1)</script>" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateContato_identity_email_unchanged()
    {
        var (client, id) = await StudentWithIdAsync();
        await client.PutAsJsonAsync("/api/alunos/me/contato", new { emailProfissional = "profissional@example.com" });
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.Equal("aluno@example.test", (await db.Users.SingleAsync(x => x.Id == id)).Email);
        });
    }

    [Fact]
    public async Task UpdateContato_idempotent_request_preserves_atualizadoEm_and_real_change_advances_it()
    {
        var (client, id) = await StudentWithIdAsync();
        var request = new
        {
            telefone = "(32) 99999-0000",
            emailProfissional = "maria.profissional@example.com",
            linkedinUrl = "https://linkedin.com/in/maria",
            githubUrl = "https://github.com/maria",
            portfolioUrl = "https://maria.dev"
        };

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.PutAsJsonAsync("/api/alunos/me/contato", request)).StatusCode);

        DateTimeOffset changedAt = DateTimeOffset.MinValue;
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var aluno = await db.Alunos.SingleAsync(x => x.UserId == id);
            changedAt = aluno.AtualizadoEm;
            Assert.Equal("(32) 99999-0000", aluno.Telefone);
            Assert.Equal("maria.profissional@example.com", aluno.EmailProfissional);
            Assert.Equal("https://linkedin.com/in/maria", aluno.LinkedInUrl);
            Assert.Equal("https://github.com/maria", aluno.GitHubUrl);
            Assert.Equal("https://maria.dev", aluno.PortfolioUrl);
        });

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.PutAsJsonAsync("/api/alunos/me/contato", request)).StatusCode);

        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var aluno = await db.Alunos.SingleAsync(x => x.UserId == id);
            Assert.Equal(changedAt, aluno.AtualizadoEm);
            Assert.Equal("(32) 99999-0000", aluno.Telefone);
            Assert.Equal("maria.profissional@example.com", aluno.EmailProfissional);
            Assert.Equal("https://linkedin.com/in/maria", aluno.LinkedInUrl);
            Assert.Equal("https://github.com/maria", aluno.GitHubUrl);
            Assert.Equal("https://maria.dev", aluno.PortfolioUrl);

            aluno.AtualizadoEm = changedAt.AddMinutes(-1);
            await db.SaveChangesAsync();
        });

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.PutAsJsonAsync("/api/alunos/me/contato", new
            {
                request.telefone,
                request.emailProfissional,
                request.linkedinUrl,
                githubUrl = "https://github.com/maria-updated",
                request.portfolioUrl
            })).StatusCode);

        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var aluno = await db.Alunos.SingleAsync(x => x.UserId == id);
            Assert.True(aluno.AtualizadoEm > changedAt.AddMinutes(-1));
            Assert.Equal("https://github.com/maria-updated", aluno.GitHubUrl);
        });
    }

    public void Dispose() => factory.Dispose();
}
