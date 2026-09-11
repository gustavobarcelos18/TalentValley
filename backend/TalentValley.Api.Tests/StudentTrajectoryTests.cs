using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class StudentTrajectoryTests : IDisposable
{
    private readonly ApiFactory factory = new();
    private const string Root = "/api/alunos/me/";

    private async Task<(HttpClient Client, Guid Id)> StudentAsync(string email = "student@example.test")
    {
        var id = await factory.CreateUserAsync(email);
        var client = factory.Client();
        (await ApiFactory.LoginAsync(client, email)).EnsureSuccessStatusCode();
        await ApiFactory.SetCsrfAsync(client);
        return (client, id);
    }

    private static JsonObject Formation(bool principal = false, bool rpv = false) => new()
    {
        ["tipo"] = "TECNICO", ["nome"] = " Técnico em Sistemas ", ["instituicao"] = " Instituto Federal ",
        ["dataInicio"] = "2025-02-01", ["dataFim"] = null, ["cargaHoraria"] = 1200,
        ["status"] = "EM_ANDAMENTO", ["principal"] = principal, ["ehRioPombaValley"] = rpv
    };

    private static JsonObject Experience() => new()
    {
        ["empresa"] = " Empresa ", ["cargo"] = " Desenvolvedor ", ["tipo"] = "PROFISSIONAL",
        ["dataInicio"] = "2025-03-01", ["dataFim"] = null, ["atual"] = true, ["descricao"] = " Trabalho "
    };

    private static JsonObject Project(int order = 1, params int[] technologies) => new()
    {
        ["ordem"] = order, ["nome"] = " Talent Valley ", ["dataInicio"] = "2026-08-01",
        ["dataFim"] = null, ["emAndamento"] = true, ["descricao"] = " Plataforma de talentos ",
        ["demoUrl"] = " https://example.test/demo ", ["repositorioUrl"] = "https://github.com/example/project",
        ["competenciaIds"] = new JsonArray(technologies.Select(x => JsonValue.Create(x)).ToArray())
    };

    private static JsonObject Request(string section) => section switch
    {
        "formacoes" => Formation(), "experiencias" => Experience(), _ => Project()
    };

    private static async Task<JsonObject> CreateAsync(HttpClient client, string section, JsonObject request)
    {
        var response = await client.PostAsJsonAsync(Root + section, request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
        return (await response.Content.ReadFromJsonAsync<JsonObject>())!;
    }

    private static async Task<JsonObject> UpdateAsync(HttpClient client, string section, Guid id, JsonObject request)
    {
        var response = await client.PutAsJsonAsync($"{Root}{section}/{id}", request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<JsonObject>())!;
    }

    private static Guid Id(JsonObject item) => item["id"]!.GetValue<Guid>();
    private static string Stamp(JsonObject item) => item["atualizadoEm"]!.GetValue<string>();
    private static async Task<JsonArray> ListAsync(HttpClient client, string section) =>
        (await client.GetFromJsonAsync<JsonArray>(Root + section))!;
    private static async Task<DateTimeOffset> ProfileStampAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!.AtualizadoEm;

    [Theory]
    [InlineData("formacoes", "nome")]
    [InlineData("experiencias", "cargo")]
    [InlineData("projetos", "nome")]
    public async Task Crud_is_owned_and_real_mutations_touch_profile_while_noops_preserve_timestamps(string section, string field)
    {
        var (client, _) = await StudentAsync();
        var (other, _) = await StudentAsync("other@example.test");
        using var ownerClient = client;
        using var otherClient = other;
        var before = await ProfileStampAsync(client);
        var request = Request(section);
        var created = await CreateAsync(client, section, request);
        var afterCreate = await ProfileStampAsync(client);
        Assert.True(afterCreate > before);
        Assert.Single(await ListAsync(client, section));
        Assert.Empty(await ListAsync(other, section));
        var id = Id(created);
        foreach (var unavailable in new[] { id, Guid.NewGuid() })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsJsonAsync($"{Root}{section}/{unavailable}", request)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await other.DeleteAsync($"{Root}{section}/{unavailable}")).StatusCode);
        }
        var noOp = await UpdateAsync(client, section, id, request);
        Assert.Equal(Stamp(created), Stamp(noOp));
        Assert.Equal(afterCreate, await ProfileStampAsync(client));
        request[field] = " Changed value ";
        var changed = await UpdateAsync(client, section, id, request);
        Assert.Equal("Changed value", changed[field]!.GetValue<string>());
        Assert.NotEqual(Stamp(created), Stamp(changed));
        var afterUpdate = await ProfileStampAsync(client);
        Assert.True(afterUpdate > afterCreate);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"{Root}{section}/{id}")).StatusCode);
        Assert.Empty(await ListAsync(client, section));
        Assert.True(await ProfileStampAsync(client) > afterUpdate);
    }

    [Fact]
    public async Task Principal_switching_create_update_unset_and_delete_allow_zero_and_preserve_index()
    {
        var (client, studentId) = await StudentAsync();
        using var ownerClient = client;
        var request = Formation(true);
        var first = await CreateAsync(client, "formacoes", request);
        var second = await CreateAsync(client, "formacoes", request);
        var rows = await ListAsync(client, "formacoes");
        Assert.Single(rows, x => x!["principal"]!.GetValue<bool>());
        Assert.False(rows.Single(x => Id(x!.AsObject()) == Id(first))!["principal"]!.GetValue<bool>());
        Assert.NotEqual(Stamp(first), Stamp(rows.Single(x => Id(x!.AsObject()) == Id(first))!.AsObject()));
        await UpdateAsync(client, "formacoes", Id(first), request);
        await factory.InScopeAsync(async p =>
        {
            var db = p.GetRequiredService<AppDbContext>();
            Assert.Equal(Id(first), (await db.Formacoes.SingleAsync(x => x.AlunoId == studentId && x.Principal)).Id);
            Assert.Equal("tecnico em sistemas", (await db.Formacoes.FindAsync(Id(first)))!.NomeBusca);
            (await db.Formacoes.FindAsync(Id(second)))!.Principal = true;
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        });
        request["principal"] = false;
        await UpdateAsync(client, "formacoes", Id(first), request);
        Assert.DoesNotContain(await ListAsync(client, "formacoes"), x => x!["principal"]!.GetValue<bool>());
        request["principal"] = true;
        await UpdateAsync(client, "formacoes", Id(first), request);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"{Root}formacoes/{Id(first)}")).StatusCode);
        Assert.False((await ListAsync(client, "formacoes")).Single()!["principal"]!.GetValue<bool>());
    }

    [Theory]
    [InlineData("VERIFICADO", "tipo", "GRADUACAO")]
    [InlineData("VERIFICADO", "nome", "Outro nome")]
    [InlineData("VERIFICADO", "instituicao", "Outra escola")]
    [InlineData("VERIFICADO", "dataInicio", "2024-01-01")]
    [InlineData("VERIFICADO", "dataFim", "2026-01-01")]
    [InlineData("VERIFICADO", "cargaHoraria", "1500")]
    [InlineData("VERIFICADO", "status", "TRANCADO")]
    [InlineData("VERIFICADO", "ehRioPombaValley", "false")]
    [InlineData("REJEITADO", "nome", "Corrigido")]
    public async Task Relevant_Rpv_edits_reset_validation(string state, string field, string value)
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var request = Formation(rpv: true);
        var created = await CreateAsync(client, "formacoes", request);
        Assert.Equal("PENDENTE", created["statusValidacaoRpv"]!.GetValue<string>());
        var id = Id(created);
        await SeedValidationAsync(id, Enum.Parse<StatusValidacaoRpv>(state));
        var noop = await UpdateAsync(client, "formacoes", id, request);
        Assert.Equal(state, noop["statusValidacaoRpv"]!.GetValue<string>());
        request["principal"] = true;
        var principalOnly = await UpdateAsync(client, "formacoes", id, request);
        Assert.Equal(state, principalOnly["statusValidacaoRpv"]!.GetValue<string>());
        request[field] = field switch
        {
            "cargaHoraria" => JsonValue.Create(int.Parse(value)),
            "ehRioPombaValley" => JsonValue.Create(false), _ => JsonValue.Create(value)
        };
        var updated = await UpdateAsync(client, "formacoes", id, request);
        if (field == "ehRioPombaValley") Assert.Null(updated["statusValidacaoRpv"]);
        else Assert.Equal("PENDENTE", updated["statusValidacaoRpv"]!.GetValue<string>());
        await factory.InScopeAsync(async p =>
        {
            var item = await p.GetRequiredService<AppDbContext>().Formacoes.FindAsync(id);
            Assert.Null(item!.ValidadoEm);
            Assert.Equal("private/certificate.pdf", item.CertificadoStorageKey);
        });
    }

    private Task SeedValidationAsync(Guid id, StatusValidacaoRpv state) => factory.InScopeAsync(async p =>
    {
        var db = p.GetRequiredService<AppDbContext>();
        var item = (await db.Formacoes.FindAsync(id))!;
        item.StatusValidacaoRpv = state;
        item.ValidadoEm = DateTimeOffset.UtcNow;
        item.CertificadoStorageKey = "private/certificate.pdf";
        await db.SaveChangesAsync();
    });

    [Fact]
    public async Task Non_rpv_is_null_workload_is_optional_and_storage_keys_never_leak()
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var request = Formation();
        request.Remove("cargaHoraria");
        var created = await CreateAsync(client, "formacoes", request);
        Assert.Null(created["statusValidacaoRpv"]);
        Assert.Null(created["cargaHoraria"]);
        Assert.Equal("TECNICO", created["tipo"]!.GetValue<string>());
        Assert.False(created["possuiCertificado"]!.GetValue<bool>());
        request["ehRioPombaValley"] = true;
        var updated = await UpdateAsync(client, "formacoes", Id(created), request);
        Assert.Equal("PENDENTE", updated["statusValidacaoRpv"]!.GetValue<string>());
        await SeedValidationAsync(Id(created), StatusValidacaoRpv.VERIFICADO);
        foreach (var path in new[] { Root + "formacoes", Root + "trajetoria", "/api/alunos/me" })
        {
            var json = await client.GetStringAsync(path);
            Assert.DoesNotContain("storagekey", json.ToLowerInvariant());
            Assert.DoesNotContain("private/certificate.pdf", json);
            Assert.Contains("\"possuiCertificado\":true", json);
        }
    }

    [Theory]
    [InlineData("formacoes", "statusValidacaoRpv", "VERIFICADO")]
    [InlineData("formacoes", "certificadoStorageKey", "private/fake.pdf")]
    [InlineData("formacoes", "alunoId", "other")]
    [InlineData("formacoes", "tipo", "INVALID")]
    [InlineData("formacoes", "status", "INVALID")]
    [InlineData("formacoes", "dataFim", "2020-01-01")]
    [InlineData("formacoes", "status", "CONCLUIDO")]
    [InlineData("formacoes", "nome", " ")]
    [InlineData("experiencias", "tipo", "VOLUNTARIO")]
    [InlineData("experiencias", "empresa", " ")]
    [InlineData("projetos", "demoUrl", "javascript:alert(1)")]
    [InlineData("projetos", "demoUrl", "https://")]
    [InlineData("projetos", "repositorioUrl", "file:///tmp/test")]
    [InlineData("projetos", "repositorioUrl", "//example.test")]
    public async Task Invalid_requests_return_problem_400_on_create_and_update(string section, string field, string value)
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var request = Request(section);
        var created = await CreateAsync(client, section, request);
        var stamp = await ProfileStampAsync(client);
        request[field] = value;
        foreach (var response in new[] { await client.PostAsJsonAsync(Root + section, request),
            await client.PutAsJsonAsync($"{Root}{section}/{Id(created)}", request) })
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType!.MediaType);
            Assert.Contains("traceId", await response.Content.ReadAsStringAsync());
        }
        Assert.Equal(stamp, await ProfileStampAsync(client));
    }

    [Theory]
    [InlineData("formacoes", "nome", 200)]
    [InlineData("formacoes", "instituicao", 200)]
    [InlineData("experiencias", "empresa", 150)]
    [InlineData("experiencias", "cargo", 150)]
    [InlineData("experiencias", "descricao", 2000)]
    [InlineData("projetos", "nome", 200)]
    [InlineData("projetos", "descricao", 1000)]
    [InlineData("projetos", "demoUrl", 2048)]
    [InlineData("projetos", "repositorioUrl", 2048)]
    public async Task Length_limits_are_enforced(string section, string field, int limit)
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var request = Request(section);
        request[field] = field.EndsWith("Url") ? "https://example.test/" + new string('a', limit - "https://example.test/".Length) : new string('a', limit);
        var created = await CreateAsync(client, section, request);
        request[field] = request[field]!.GetValue<string>() + "a";
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Root}{section}/{Id(created)}", request)).StatusCode);
    }

    [Theory]
    [InlineData("formacoes")]
    [InlineData("experiencias")]
    [InlineData("projetos")]
    public async Task Missing_required_dates_and_numeric_enums_are_rejected(string section)
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var request = Request(section);
        request.Remove("dataInicio");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(Root + section, request)).StatusCode);
        request = Request(section);
        if (section != "projetos") request["tipo"] = 0;
        else request["ordem"] = 0;
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(Root + section, request)).StatusCode);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task Workload_must_be_positive_when_present(int hours)
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var request = Formation();
        request["cargaHoraria"] = hours;
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(Root + "formacoes", request)).StatusCode);
    }

    [Theory]
    [InlineData("PROFISSIONAL")]
    [InlineData("ESTAGIO")]
    public async Task Experience_current_clears_end_date_before_validation_and_noop_comparison(string type)
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var request = Experience();
        request["tipo"] = type;
        request["dataFim"] = "2020-01-01";
        var created = await CreateAsync(client, "experiencias", request);
        Assert.Equal(type, created["tipo"]!.GetValue<string>());
        Assert.Null(created["dataFim"]);
        Assert.Equal(Stamp(created), Stamp(await UpdateAsync(client, "experiencias", Id(created), request)));
        request["atual"] = false;
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Root}experiencias/{Id(created)}", request)).StatusCode);
        request["dataFim"] = "2025-03-01";
        Assert.Equal("2025-03-01", (await UpdateAsync(client, "experiencias", Id(created), request))["dataFim"]!.GetValue<string>());
    }

    [Theory]
    [InlineData(0)]
    [InlineData(3)]
    [InlineData(-1)]
    public async Task Project_order_must_be_one_or_two(int order)
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(Root + "projetos", Project(order))).StatusCode);
    }

    [Fact]
    public async Task Project_current_normalizes_dates_and_completed_dates_are_validated()
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var request = Project();
        request["dataFim"] = "2020-01-01";
        var created = await CreateAsync(client, "projetos", request);
        Assert.Null(created["dataFim"]);
        Assert.Equal(Stamp(created), Stamp(await UpdateAsync(client, "projetos", Id(created), request)));
        request["emAndamento"] = false;
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Root}projetos/{Id(created)}", request)).StatusCode);
        request["dataFim"] = "2026-08-01";
        await UpdateAsync(client, "projetos", Id(created), request);
    }

    [Fact]
    public async Task Project_limit_swaps_both_directions_preserve_identity_fields_technologies_and_constraints()
    {
        var (client, studentId) = await StudentAsync();
        using var ownerClient = client;
        var catalog = (await client.GetFromJsonAsync<CatalogoCompetenciaResponse[]>("/api/competencias"))!;
        var requestA = Project(1, catalog[0].Id);
        var requestB = Project(2, catalog[1].Id);
        requestB["nome"] = "Second project";
        var a = await CreateAsync(client, "projetos", requestA);
        var b = await CreateAsync(client, "projetos", requestB);
        var stamp = await ProfileStampAsync(client);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync(Root + "projetos", Project())).StatusCode);
        Assert.Equal(stamp, await ProfileStampAsync(client));
        foreach (var order in new[] { 1, 2 })
        {
            requestB["ordem"] = order;
            await UpdateAsync(client, "projetos", Id(b), requestB);
            var rows = await ListAsync(client, "projetos");
            Assert.Equal(new[] { 1, 2 }, rows.Select(x => x!["ordem"]!.GetValue<int>()));
            var storedA = rows.Single(x => Id(x!.AsObject()) == Id(a))!.AsObject();
            var storedB = rows.Single(x => Id(x!.AsObject()) == Id(b))!.AsObject();
            Assert.Equal(3 - order, storedA["ordem"]!.GetValue<int>());
            Assert.Equal(order, storedB["ordem"]!.GetValue<int>());
            foreach (var (original, stored) in new[] { (a, storedA), (b, storedB) })
            {
                foreach (var field in new[] { "id", "nome", "dataInicio", "dataFim", "descricao", "demoUrl", "repositorioUrl", "criadoEm", "competencias" })
                    Assert.True(JsonNode.DeepEquals(original[field], stored[field]), field);
                Assert.NotEqual(Stamp(original), Stamp(stored));
            }
        }
        await factory.InScopeAsync(async p =>
        {
            var db = p.GetRequiredService<AppDbContext>();
            var rows = await db.Projetos.Where(x => x.AlunoId == studentId).ToListAsync();
            Assert.Equal(2, rows.Count);
            rows[0].Ordem = rows[1].Ordem;
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        });
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public async Task Project_delete_compacts_only_when_needed(int deletedOrder)
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var a = await CreateAsync(client, "projetos", Project(1));
        var b = await CreateAsync(client, "projetos", Project(2));
        var removed = deletedOrder == 1 ? a : b;
        var kept = deletedOrder == 1 ? b : a;
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"{Root}projetos/{Id(removed)}")).StatusCode);
        var remaining = Assert.Single(await ListAsync(client, "projetos"))!.AsObject();
        Assert.Equal(Id(kept), Id(remaining));
        Assert.Equal(1, remaining["ordem"]!.GetValue<int>());
        if (deletedOrder == 1) Assert.NotEqual(Stamp(kept), Stamp(remaining));
        else Assert.Equal(Stamp(kept), Stamp(remaining));
    }

    [Fact]
    public async Task Creating_in_occupied_order_moves_existing_project_to_free_order()
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var first = await CreateAsync(client, "projetos", Project());
        var second = await CreateAsync(client, "projetos", Project());
        var rows = await ListAsync(client, "projetos");
        Assert.Equal(Id(second), Id(rows[0]!.AsObject()));
        Assert.Equal(Id(first), Id(rows[1]!.AsObject()));
        Assert.Equal(2, rows[1]!["ordem"]!.GetValue<int>());
    }

    [Fact]
    public async Task Project_technologies_replace_as_sets_and_remain_independent_of_general_competencies()
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var catalog = (await client.GetFromJsonAsync<CatalogoCompetenciaResponse[]>("/api/competencias"))!;
        var ids = catalog.Take(3).Select(x => x.Id).ToArray();
        (await client.PutAsJsonAsync(Root + "competencias", new { competenciaIds = new[] { ids[0] } })).EnsureSuccessStatusCode();
        var created = await CreateAsync(client, "projetos", Project(1, ids[0], ids[1]));
        var stamp = await ProfileStampAsync(client);
        Assert.Equal(Stamp(created), Stamp(await UpdateAsync(client, "projetos", Id(created), Project(1, ids[1], ids[0]))));
        Assert.Equal(stamp, await ProfileStampAsync(client));
        foreach (var invalidIds in new[] { new[] { ids[0], ids[0] }, new[] { int.MaxValue } })
        {
            var request = Project(2, invalidIds);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(Root + "projetos", request)).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Root}projetos/{Id(created)}", request)).StatusCode);
            Assert.Equal(stamp, await ProfileStampAsync(client));
        }
        var updated = await UpdateAsync(client, "projetos", Id(created), Project(1, ids[2]));
        Assert.Equal(ids[2], Assert.Single(updated["competencias"]!.AsArray())!["id"]!.GetValue<int>());
        var profile = (await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!;
        Assert.Equal(ids[0], Assert.Single(profile.Competencias).Id);
        Assert.Equal(ids[2], Assert.Single(Assert.Single(profile.Projetos).Competencias).Id);
        Assert.True(profile.AtualizadoEm > stamp);
        updated = await UpdateAsync(client, "projetos", Id(created), Project());
        Assert.Empty(updated["competencias"]!.AsArray());
    }

    [Fact]
    public async Task Concurrent_project_creation_serializes_count_and_order_allocation()
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var responses = await Task.WhenAll(Enumerable.Range(0, 4).Select(_ => client.PostAsJsonAsync(Root + "projetos", Project())));
        Assert.Equal(2, responses.Count(x => x.StatusCode == HttpStatusCode.Created));
        Assert.Equal(2, responses.Count(x => x.StatusCode == HttpStatusCode.Conflict));
        Assert.Equal(new[] { 1, 2 }, (await ListAsync(client, "projetos")).Select(x => x!["ordem"]!.GetValue<int>()));
    }

    [Fact]
    public async Task Concurrent_principal_creation_leaves_exactly_one_principal()
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var responses = await Task.WhenAll(Enumerable.Range(0, 3).Select(_ => client.PostAsJsonAsync(Root + "formacoes", Formation(true))));
        Assert.All(responses, x => Assert.Equal(HttpStatusCode.Created, x.StatusCode));
        Assert.Single(await ListAsync(client, "formacoes"), x => x!["principal"]!.GetValue<bool>());
    }

    [Fact]
    public async Task Trajectory_combines_owned_education_and_experience_with_stable_current_date_kind_id_order()
    {
        var (client, _) = await StudentAsync();
        var (other, _) = await StudentAsync("other@example.test");
        using var ownerClient = client;
        using var otherClient = other;
        await CreateAsync(other, "formacoes", Formation());
        await CreateAsync(other, "experiencias", Experience());
        await CreateAsync(client, "projetos", Project());
        var request = Formation();
        request["dataInicio"] = "2020-01-01";
        var f1 = await CreateAsync(client, "formacoes", request);
        var f2 = await CreateAsync(client, "formacoes", request);
        var exp = Experience();
        exp["dataInicio"] = "2020-01-01";
        var e1 = await CreateAsync(client, "experiencias", exp);
        exp["dataInicio"] = "2024-01-01";
        var e2 = await CreateAsync(client, "experiencias", exp);
        request["status"] = "CONCLUIDO";
        request["dataInicio"] = "2026-01-01";
        request["dataFim"] = "2026-02-01";
        var finished = await CreateAsync(client, "formacoes", request);
        var timeline = (await client.GetFromJsonAsync<TrajetoriaItemResponse[]>(Root + "trajetoria", ApiFactory.JsonOptions))!;
        var expected = new[] { Id(e2) }.Concat(new[] { Id(f1), Id(f2) }.Order()).Concat([Id(e1), Id(finished)]);
        Assert.Equal(expected, timeline.Select(x => x.Id));
        Assert.All(timeline.Take(4), x => Assert.True(x.Atual));
        Assert.False(timeline.Last().Atual);
        Assert.All(timeline, x =>
        {
            if (x.TipoItem == TipoItemTrajetoria.FORMACAO)
            {
                Assert.NotNull(x.Formacao); Assert.Null(x.Experiencia);
                Assert.Equal(x.Formacao.Nome, x.Titulo); Assert.Equal(x.Formacao.Instituicao, x.Subtitulo);
            }
            else
            {
                Assert.NotNull(x.Experiencia); Assert.Null(x.Formacao);
                Assert.Equal(x.Experiencia.Cargo, x.Titulo); Assert.Equal(x.Experiencia.Empresa, x.Subtitulo);
            }
        });
        Assert.Equal(await client.GetStringAsync(Root + "trajetoria"), await client.GetStringAsync(Root + "trajetoria"));
        var profile = (await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!;
        Assert.Equal(3, profile.Formacoes.Count);
        Assert.Equal(2, profile.Experiencias.Count);
        Assert.Single(profile.Projetos);
        Assert.Null(profile.DadosBasicos.FotoUrl);
    }

    [Theory]
    [InlineData("formacoes")]
    [InlineData("experiencias")]
    [InlineData("projetos")]
    public async Task Every_mutation_requires_valid_csrf(string section)
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var created = await CreateAsync(client, section, Request(section));
        foreach (var token in new string?[] { null, "invalid" })
        {
            client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
            if (token is not null) client.DefaultRequestHeaders.Add("X-XSRF-TOKEN", token);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(Root + section, Request(section))).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"{Root}{section}/{Id(created)}", Request(section))).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await client.DeleteAsync($"{Root}{section}/{Id(created)}")).StatusCode);
        }
        Assert.Single(await ListAsync(client, section));
    }

    [Theory]
    [InlineData(AppRoles.Admin)]
    [InlineData(AppRoles.Recruiter)]
    [InlineData(AppRoles.Student)]
    public async Task All_routes_enforce_current_account_and_role(string role)
    {
        var id = await factory.CreateUserAsync("account@example.test", role);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, "account@example.test");
        await ApiFactory.SetCsrfAsync(client);
        if (role == AppRoles.Student)
            await factory.InScopeAsync(async p =>
            {
                var db = p.GetRequiredService<AppDbContext>();
                (await db.Alunos.FindAsync(id))!.Ativo = false;
                await db.SaveChangesAsync();
            });
        using var anonymous = factory.Client();
        foreach (var section in new[] { "formacoes", "experiencias", "projetos", "trajetoria" })
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(Root + section)).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(Root + section)).StatusCode);
            if (section == "trajetoria") continue;
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync(Root + section, Request(section))).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync($"{Root}{section}/{Guid.NewGuid()}", Request(section))).StatusCode);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync($"{Root}{section}/{Guid.NewGuid()}")).StatusCode);
        }
    }

    [Theory]
    [InlineData("swap")]
    [InlineData("compaction")]
    [InlineData("principal")]
    public async Task Failed_multirow_mutation_rolls_back_resources_joins_and_profile_timestamp(string operation)
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var catalog = (await client.GetFromJsonAsync<CatalogoCompetenciaResponse[]>("/api/competencias"))!;
        var section = operation == "principal" ? "formacoes" : "projetos";
        var a = await CreateAsync(client, section, operation == "principal" ? Formation(true) : Project(1, catalog[0].Id));
        var request = operation == "principal" ? Formation() : Project(2, catalog[1].Id);
        request["nome"] = "Second";
        var b = await CreateAsync(client, section, request);
        var before = await client.GetStringAsync(Root + section);
        var stamp = await ProfileStampAsync(client);
        await factory.InScopeAsync(async p =>
        {
            var db = p.GetRequiredService<AppDbContext>();
            var sql = operation switch
            {
                "swap" => "CREATE TRIGGER FailMutation BEFORE INSERT ON Projetos BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
                "compaction" => "CREATE TRIGGER FailMutation BEFORE UPDATE OF Ordem ON Projetos BEGIN SELECT RAISE(ABORT, 'test failure'); END;",
                _ => "CREATE TRIGGER FailMutation BEFORE UPDATE OF Principal ON Formacoes WHEN NEW.Principal = 1 BEGIN SELECT RAISE(ABORT, 'test failure'); END;"
            };
            await db.Database.ExecuteSqlRawAsync(sql);
        });
        HttpResponseMessage response;
        if (operation == "compaction") response = await client.DeleteAsync($"{Root}{section}/{Id(a)}");
        else
        {
            if (operation == "principal") request["principal"] = true;
            else request["ordem"] = 1;
            response = await client.PutAsJsonAsync($"{Root}{section}/{Id(b)}", request);
        }
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.DoesNotContain("test failure", await response.Content.ReadAsStringAsync());
        Assert.Equal(before, await client.GetStringAsync(Root + section));
        Assert.Equal(stamp, await ProfileStampAsync(client));
    }

    [Theory]
    [InlineData("CURSO_LIVRE", "EM_ANDAMENTO")]
    [InlineData("TECNICO", "CONCLUIDO")]
    [InlineData("TECNOLOGO", "TRANCADO")]
    [InlineData("GRADUACAO", "CONCLUIDO")]
    [InlineData("POS_GRADUACAO", "EM_ANDAMENTO")]
    public async Task All_formation_types_and_statuses_roundtrip_as_strings(string type, string status)
    {
        var (client, _) = await StudentAsync();
        using var ownerClient = client;
        var request = Formation();
        request["tipo"] = type;
        request["status"] = status;
        request["dataFim"] = "2025-02-01";
        var created = await CreateAsync(client, "formacoes", request);
        Assert.Equal(type, created["tipo"]!.GetValue<string>());
        Assert.Equal(status, created["status"]!.GetValue<string>());
    }

    [Fact]
    public async Task Optional_workload_migration_preserves_existing_formation_data_and_principal_index()
    {
        var studentId = await factory.CreateUserAsync("migration@example.test");
        await factory.InScopeAsync(async p =>
        {
            var db = p.GetRequiredService<AppDbContext>();
            var migrator = db.GetService<IMigrator>();
            await migrator.MigrateAsync("20260911122211_AdminAccountProvisioning");
            var id = Guid.NewGuid();
            db.Formacoes.Add(new()
            {
                Id = id, AlunoId = studentId, Tipo = TipoFormacao.TECNICO, Nome = "Existing formation",
                NomeBusca = "existing formation", Instituicao = "Institute", CargaHoraria = 1200,
                DataInicio = new(2025, 1, 1), Principal = true, EhRioPombaValley = true,
                StatusValidacaoRpv = StatusValidacaoRpv.VERIFICADO, CertificadoStorageKey = "private/existing.pdf"
            });
            await db.SaveChangesAsync();
            await migrator.MigrateAsync();
            db.ChangeTracker.Clear();
            var item = (await db.Formacoes.FindAsync(id))!;
            Assert.Equal(1200, item.CargaHoraria);
            Assert.True(item.Principal);
            Assert.Equal(StatusValidacaoRpv.VERIFICADO, item.StatusValidacaoRpv);
            Assert.Equal("private/existing.pdf", item.CertificadoStorageKey);
            item.CargaHoraria = null;
            await db.SaveChangesAsync();
            db.Formacoes.Add(new() { Id = Guid.NewGuid(), AlunoId = studentId, Nome = "Other", NomeBusca = "other", Instituicao = "Institute", Principal = true });
            await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        });
    }

    public void Dispose() => factory.Dispose();
}
