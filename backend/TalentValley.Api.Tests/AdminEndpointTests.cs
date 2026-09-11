using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class AdminEndpointTests : IDisposable
{
    private readonly ApiFactory factory = new();
    private static readonly string Id = Guid.NewGuid().ToString();
    private static readonly (HttpMethod Method, string Path)[] Routes =
    [
        (HttpMethod.Post, "/api/admin/alunos"), (HttpMethod.Get, "/api/admin/alunos"),
        (HttpMethod.Post, $"/api/admin/alunos/{Id}/bloquear"), (HttpMethod.Post, $"/api/admin/alunos/{Id}/reativar"),
        (HttpMethod.Delete, $"/api/admin/alunos/{Id}"),
        (HttpMethod.Post, "/api/admin/recrutadores"), (HttpMethod.Get, "/api/admin/recrutadores"),
        (HttpMethod.Get, $"/api/admin/recrutadores/{Id}"),
        (HttpMethod.Post, $"/api/admin/recrutadores/{Id}/bloquear"), (HttpMethod.Post, $"/api/admin/recrutadores/{Id}/reativar"),
        (HttpMethod.Post, $"/api/admin/usuarios/{Id}/reenviar-ativacao"), (HttpMethod.Get, "/api/admin/auditoria"),
        (HttpMethod.Get, "/api/admin/validacoes-rpv"), (HttpMethod.Get, $"/api/admin/validacoes-rpv/{Id}"),
        (HttpMethod.Get, $"/api/admin/validacoes-rpv/{Id}/certificado"),
        (HttpMethod.Post, $"/api/admin/validacoes-rpv/{Id}/aprovar"),
        (HttpMethod.Post, $"/api/admin/validacoes-rpv/{Id}/rejeitar"),
        (HttpMethod.Post, $"/api/admin/validacoes-rpv/{Id}/remover-validacao")
    ];

    private async Task<HttpClient> AdminAsync()
    {
        await factory.CreateUserAsync("admin@example.test", AppRoles.Admin);
        var client = factory.Client();
        await ApiFactory.LoginAsync(client, "admin@example.test");
        await ApiFactory.SetCsrfAsync(client);
        return client;
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData(AppRoles.Student, HttpStatusCode.Forbidden)]
    [InlineData(AppRoles.Recruiter, HttpStatusCode.Forbidden)]
    public async Task Every_admin_route_requires_current_admin_policy(string? role, HttpStatusCode expected)
    {
        using var client = factory.Client();
        if (role is not null)
        {
            await factory.CreateUserAsync("person@example.test", role);
            await ApiFactory.LoginAsync(client, "person@example.test");
        }
        foreach (var (method, path) in Routes)
        {
            using var request = new HttpRequestMessage(method, path) { Content = JsonContent.Create(new { }) };
            Assert.Equal(expected, (await client.SendAsync(request)).StatusCode);
        }
    }

    [Fact]
    public async Task Every_mutation_requires_antiforgery_and_unknown_targets_return_404()
    {
        using var client = await AdminAsync();
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        foreach (var (method, path) in Routes.Where(x => x.Method != HttpMethod.Get))
        {
            using var request = new HttpRequestMessage(method, path) { Content = JsonContent.Create(new { }) };
            var response = await client.SendAsync(request);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Contains("antiforgery", await response.Content.ReadAsStringAsync());
        }
        await ApiFactory.SetCsrfAsync(client);
        foreach (var (method, path) in Routes.Where(x => x.Path.Contains(Id)))
            Assert.Equal(HttpStatusCode.NotFound, (await client.SendAsync(new HttpRequestMessage(method, path))).StatusCode);
    }

    public static IEnumerable<object[]> InvalidCreationRequests()
    {
        foreach (var resource in new[] { "alunos", "recrutadores" })
        {
            foreach (var name in new string?[] { null, "", "   ", "  Ab  ", new('x', 151) })
                yield return [resource, "nomeCompleto", name!];
            foreach (var email in new string?[] { null, "", "invalid", new string('a', 245) + "@example.test" })
                yield return [resource, "email", email!];
        }
        foreach (var (field, max) in new[] { ("empresa", 150), ("cargo", 120), ("cidade", 120) })
            foreach (var value in new[] { "", "  X  ", new string('x', max + 1) })
                yield return ["recrutadores", field, value];
        foreach (var phone in new[] { "  ", new string('1', 21) }) yield return ["recrutadores", "telefone", phone];
        foreach (var uf in new[] { "", "M", "MGG", "12", "M1", "MÉ" }) yield return ["recrutadores", "uf", uf];
    }

    [Theory]
    [MemberData(nameof(InvalidCreationRequests))]
    public async Task Creation_validates_trimmed_fields(string resource, string field, string? invalid)
    {
        using var client = await AdminAsync();
        var body = new Dictionary<string, string?>
        {
            ["nomeCompleto"] = "João Silva", ["email"] = "person@example.test", ["empresa"] = "Empresa A",
            ["cargo"] = "Analista", ["cidade"] = "Cataguases", ["telefone"] = "123", ["uf"] = "MG"
        };
        body[field] = invalid;
        var response = await client.PostAsJsonAsync($"/api/admin/{resource}", body);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("errors", await response.Content.ReadAsStringAsync());
        Assert.Empty(factory.Emails.Activations);
    }

    [Fact]
    public async Task Lists_filter_order_and_paginate_in_SQL_and_detail_uses_string_status()
    {
        using var client = await AdminAsync();
        for (var i = 11; i >= 0; i--)
        {
            Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/admin/alunos",
                new { nomeCompleto = $"João {i:D2}", email = $"student{i}@example.test" })).StatusCode);
            Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/admin/recrutadores",
                AdminProvisioningTests.Recruiter($"recruiter{i}@example.test", $"Carlos {i:D2}"))).StatusCode);
        }
        var first = (await client.GetFromJsonAsync<PaginatedResponse<AlunoListItem>>("/api/admin/alunos?search=joao"))!;
        var second = (await client.GetFromJsonAsync<PaginatedResponse<AlunoListItem>>("/api/admin/alunos?page=2&search=joao"))!;
        Assert.Equal(10, first.PageSize);
        Assert.Equal(12, first.TotalItems);
        Assert.Equal(2, first.TotalPages);
        Assert.Equal(10, first.Items.Count);
        Assert.Equal(2, second.Items.Count);
        Assert.Equal(2, second.Page);
        Assert.Equal(Enumerable.Range(0, 12).Select(i => $"João {i:D2}"), first.Items.Concat(second.Items).Select(x => x.NomeCompleto));

        var recruiters = JsonDocument.Parse(await client.GetStringAsync("/api/admin/recrutadores?search=INOVACAO&status=ATIVO")).RootElement;
        Assert.Equal(12, recruiters.GetProperty("totalItems").GetInt32());
        Assert.Equal(10, recruiters.GetProperty("items").GetArrayLength());
        var recruiter = recruiters.GetProperty("items")[0];
        var id = recruiter.GetProperty("id").GetGuid();
        Assert.Equal("Carlos 00", recruiter.GetProperty("nomeCompleto").GetString());
        Assert.Equal("ATIVO", recruiter.GetProperty("status").GetString());
        var detail = JsonDocument.Parse(await client.GetStringAsync($"/api/admin/recrutadores/{id}")).RootElement;
        Assert.Equal("recruiter0@example.test", detail.GetProperty("email").GetString());
        Assert.Equal("Inovação Ágil", detail.GetProperty("empresa").GetString());
        Assert.Equal("(32) 99999-1001", detail.GetProperty("telefone").GetString());
        Assert.Equal("MG", detail.GetProperty("uf").GetString());
        Assert.Equal(JsonValueKind.Null, detail.GetProperty("ultimoAcessoEm").ValueKind);
        await client.PostAsync($"/api/admin/recrutadores/{id}/bloquear", null);
        var filtered = JsonDocument.Parse(await client.GetStringAsync("/api/admin/recrutadores?search=carlos&status=BLOQUEADO")).RootElement;
        Assert.Equal(1, filtered.GetProperty("totalItems").GetInt32());
        Assert.Equal("BLOQUEADO", filtered.GetProperty("items")[0].GetProperty("status").GetString());
        var recruiterPage2 = JsonDocument.Parse(await client.GetStringAsync("/api/admin/recrutadores?page=2")).RootElement;
        Assert.Equal(2, recruiterPage2.GetProperty("items").GetArrayLength());

        var audit = JsonDocument.Parse(await client.GetStringAsync("/api/admin/auditoria")).RootElement;
        var audit2 = JsonDocument.Parse(await client.GetStringAsync("/api/admin/auditoria?page=2")).RootElement;
        Assert.Equal(20, audit.GetProperty("pageSize").GetInt32());
        Assert.Equal(25, audit.GetProperty("totalItems").GetInt32());
        Assert.Equal(2, audit.GetProperty("totalPages").GetInt32());
        Assert.Equal(20, audit.GetProperty("items").GetArrayLength());
        Assert.Equal(5, audit2.GetProperty("items").GetArrayLength());
        Assert.Equal("RECRUTADOR_BLOQUEADO", audit.GetProperty("items")[0].GetProperty("acao").GetString());
        var entries = audit.GetProperty("items").EnumerateArray().Concat(audit2.GetProperty("items").EnumerateArray()).ToArray();
        var times = entries.Select(x => x.GetProperty("criadoEm").GetDateTimeOffset()).ToArray();
        Assert.Equal(times.OrderDescending(), times);
        Assert.All(entries, x => Assert.Equal("admin@example.test", x.GetProperty("adminEmail").GetString()));
        Assert.Empty((await client.GetFromJsonAsync<PaginatedResponse<AlunoListItem>>("/api/admin/alunos?page=100"))!.Items);
        Assert.Equal(0, (await client.GetFromJsonAsync<PaginatedResponse<AlunoListItem>>("/api/admin/alunos?search=absent"))!.TotalPages);
    }

    [Theory]
    [InlineData("alunos?page=0")]
    [InlineData("alunos?page=2147483647")]
    [InlineData("alunos?page=abc")]
    [InlineData("recrutadores?page=-1")]
    [InlineData("recrutadores?status=PENDENTE")]
    [InlineData("recrutadores?status=0")]
    [InlineData("recrutadores?status=999")]
    [InlineData("auditoria?page=0")]
    [InlineData("validacoes-rpv?page=0")]
    [InlineData("validacoes-rpv?page=2147483647")]
    public async Task Invalid_query_returns_validation_problem(string query)
    {
        using var client = await AdminAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/admin/" + query)).StatusCode);
    }

    [Fact]
    public async Task Concurrent_creation_preserves_email_and_slug_uniqueness()
    {
        using var client = await AdminAsync();
        var sameEmail = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => client.PostAsJsonAsync("/api/admin/alunos",
            new { nomeCompleto = "João Silva", email = "same@example.test" })));
        Assert.Single(sameEmail, x => x.StatusCode == HttpStatusCode.Created);
        Assert.Single(sameEmail, x => x.StatusCode == HttpStatusCode.Conflict);
        var sameName = await Task.WhenAll(Enumerable.Range(0, 3).Select(i => client.PostAsJsonAsync("/api/admin/alunos",
            new { nomeCompleto = "João Silva", email = $"distinct{i}@example.test" })));
        Assert.All(sameName, x => Assert.Equal(HttpStatusCode.Created, x.StatusCode));
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            Assert.Equal(new[] { "joao-silva", "joao-silva-2", "joao-silva-3", "joao-silva-4" },
                await db.Alunos.Select(x => x.Slug).OrderBy(x => x).ToArrayAsync());
            Assert.Equal(4, await db.Auditorias.CountAsync());
        });
        Assert.Equal(4, factory.Emails.Activations.Count);
    }

    public void Dispose() => factory.Dispose();
}
