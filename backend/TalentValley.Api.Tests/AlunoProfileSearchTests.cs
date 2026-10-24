using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

// "O que eu busco": status, objective, areas, start date, workload, mobility, driver's license and PCD.
public sealed class AlunoProfileSearchTests : IDisposable
{
    private const string Email = "aluno@example.test";
    private const string AvailabilityUrl = "/api/alunos/me/disponibilidade";
    private const string ConfirmUrl = "/api/alunos/me/busca/confirmar";
    private readonly ApiFactory factory = new();

    private async Task<HttpClient> StudentClientAsync(string email = Email)
    {
        await factory.CreateUserAsync(email);
        var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        return client;
    }

    private static Dictionary<string, object?> Form(Action<Dictionary<string, object?>>? change = null)
    {
        var form = new Dictionary<string, object?>
        {
            ["disponibilidades"] = new[] { "ESTAGIO" },
            ["modalidades"] = new[] { "REMOTO" },
            ["statusBusca"] = "BUSCANDO_ATIVAMENTE",
            ["objetivoProfissional"] = "  Quero atuar com back-end.  ",
            ["areasInteresse"] = new[] { "DesenvolvimentoBackend", "DevOps" },
            ["disponivelImediatamente"] = false,
            ["disponivelAPartirDe"] = "2027-01-15",
            ["cargaHorariaSemanal"] = "ATE_30H",
            ["aceitaViajar"] = true,
            ["aceitaMudarDeCidade"] = false,
            ["categoriasCnh"] = new[] { "B", "A" },
            ["possuiVeiculoProprio"] = true,
            ["souPcd"] = false,
            ["interesseVagaPcd"] = false,
            ["tiposDeficiencia"] = Array.Empty<string>(),
            ["consentimentoPcd"] = false
        };
        change?.Invoke(form);
        return form;
    }

    private static Task<HttpResponseMessage> SaveAsync(HttpClient client, Dictionary<string, object?> form) =>
        client.PutAsJsonAsync(AvailabilityUrl, form);

    private static async Task<BuscaResponse> BuscaAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!.Busca;

    private static void AssertNoPcd(PcdResponse pcd)
    {
        Assert.False(pcd.SouPcd);
        Assert.False(pcd.InteresseVagaPcd);
        Assert.Empty(pcd.Tipos);
        Assert.Null(pcd.ConsentimentoEm);
    }

    private Task ChangeAlunoAsync(Guid id, Action<Aluno> change) => factory.InScopeAsync(async provider =>
    {
        var db = provider.GetRequiredService<AppDbContext>();
        change(await db.Alunos.SingleAsync(x => x.UserId == id));
        await db.SaveChangesAsync();
    });

    private async Task<Guid> UserIdAsync(string email)
    {
        var id = Guid.Empty;
        await factory.InScopeAsync(async provider =>
            id = (await provider.GetRequiredService<AppDbContext>().Users.SingleAsync(x => x.Email == email)).Id);
        return id;
    }

    [Fact]
    public async Task New_student_has_an_empty_search_profile()
    {
        using var client = await StudentClientAsync();
        var busca = await BuscaAsync(client);
        Assert.Null(busca.Status);
        Assert.Null(busca.StatusConfirmadoEm);
        Assert.False(busca.StatusDesatualizado);
        Assert.Null(busca.Objetivo);
        Assert.Empty(busca.AreasInteresse);
        Assert.False(busca.DisponivelImediatamente);
        Assert.Null(busca.DisponivelAPartirDe);
        Assert.Null(busca.CargaHoraria);
        Assert.Empty(busca.CategoriasCnh);
        AssertNoPcd(busca.Pcd);
    }

    [Fact]
    public async Task Saving_the_form_stores_every_field_and_confirms_the_status()
    {
        using var client = await StudentClientAsync();
        var before = DateTimeOffset.UtcNow;
        Assert.Equal(HttpStatusCode.NoContent, (await SaveAsync(client, Form())).StatusCode);

        var busca = await BuscaAsync(client);
        Assert.Equal(StatusBusca.BUSCANDO_ATIVAMENTE, busca.Status);
        Assert.True(busca.StatusConfirmadoEm >= before.AddSeconds(-1));
        Assert.False(busca.StatusDesatualizado);
        Assert.Equal("Quero atuar com back-end.", busca.Objetivo);
        Assert.Equal([AreaInteresse.DesenvolvimentoBackend, AreaInteresse.DevOps], busca.AreasInteresse);
        Assert.False(busca.DisponivelImediatamente);
        Assert.Equal(new DateOnly(2027, 1, 15), busca.DisponivelAPartirDe);
        Assert.Equal(CargaHorariaSemanal.ATE_30H, busca.CargaHoraria);
        Assert.True(busca.AceitaViajar);
        Assert.False(busca.AceitaMudarDeCidade);
        Assert.Equal([CategoriaCnh.A, CategoriaCnh.B], busca.CategoriasCnh);
        Assert.True(busca.PossuiVeiculoProprio);
        AssertNoPcd(busca.Pcd);
    }

    [Fact]
    public async Task Saving_again_replaces_the_collections_and_can_clear_optional_fields()
    {
        using var client = await StudentClientAsync();
        await SaveAsync(client, Form());
        var response = await SaveAsync(client, Form(f =>
        {
            f["statusBusca"] = null;
            f["objetivoProfissional"] = "   ";
            f["areasInteresse"] = new[] { "Redes" };
            f["disponivelImediatamente"] = true;
            f["disponivelAPartirDe"] = null;
            f["cargaHorariaSemanal"] = null;
            f["categoriasCnh"] = Array.Empty<string>();
        }));
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var busca = await BuscaAsync(client);
        Assert.Null(busca.Status);
        Assert.Null(busca.StatusConfirmadoEm);
        Assert.Null(busca.Objetivo);
        Assert.Equal([AreaInteresse.Redes], busca.AreasInteresse);
        Assert.True(busca.DisponivelImediatamente);
        Assert.Null(busca.DisponivelAPartirDe);
        Assert.Null(busca.CargaHoraria);
        Assert.Empty(busca.CategoriasCnh);
    }

    [Fact]
    public async Task A_start_date_in_the_past_is_accepted()
    {
        using var client = await StudentClientAsync();
        var past = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-10).ToString("yyyy-MM-dd");
        Assert.Equal(HttpStatusCode.NoContent, (await SaveAsync(client, Form(f => f["disponivelAPartirDe"] = past))).StatusCode);
        Assert.Equal(DateOnly.Parse(past), (await BuscaAsync(client)).DisponivelAPartirDe);
    }

    public static TheoryData<string, Action<Dictionary<string, object?>>> InvalidForms => new()
    {
        { "objective over 280 characters", f => f["objetivoProfissional"] = new string('a', 281) },
        { "objective with emoji", f => f["objetivoProfissional"] = "Quero crescer 🚀" },
        { "objective with line break", f => f["objetivoProfissional"] = "linha um\nlinha dois" },
        { "more than 5 areas", f => f["areasInteresse"] = new[] { "Redes", "DevOps", "Agilidade", "Inovacao", "PessoasRh", "Audiovisual" } },
        { "repeated areas", f => f["areasInteresse"] = new[] { "Redes", "Redes" } },
        { "unknown area", f => f["areasInteresse"] = new[] { "Inexistente" } },
        // Only combinations that land outside the enum are rejected; ones that happen to land on a defined value
        // (e.g. "B, C" becomes D) are a limit of the global JSON enum converter, pending a decision by the maintainer.
        { "comma-joined areas", f => f["areasInteresse"] = new[] { "Audiovisual, DesenvolvimentoFrontend" } },
        { "comma-joined license categories", f => f["categoriasCnh"] = new[] { "D, E" } },
        { "comma-joined disability types", f => f["tiposDeficiencia"] = new[] { "OUTRA, VISUAL" } },
        { "comma-joined availability types", f => f["disponibilidades"] = new[] { "PJ, TRAINEE" } },
        { "comma-joined modalities", f => f["modalidades"] = new[] { "HIBRIDO, REMOTO" } },
        { "numeric area", f => f["areasInteresse"] = new[] { 1 } },
        { "unknown status", f => f["statusBusca"] = "TALVEZ" },
        { "unknown workload", f => f["cargaHorariaSemanal"] = "ATE_10H" },
        { "repeated license categories", f => f["categoriasCnh"] = new[] { "B", "B" } },
        { "unknown license category", f => f["categoriasCnh"] = new[] { "F" } },
        { "repeated disability types", f => f["tiposDeficiencia"] = new[] { "VISUAL", "VISUAL" } },
        { "immediate and a date together", f => f["disponivelImediatamente"] = true },
        { "start date out of range", f => f["disponivelAPartirDe"] = "1800-01-01" },
        { "missing availability types", f => f.Remove("disponibilidades") },
        { "unexpected field", f => f["alunoId"] = Guid.NewGuid() },
        { "PCD without consent", f => f["souPcd"] = true },
        { "interest in PCD jobs without consent", f => f["interesseVagaPcd"] = true }
    };

    [Theory]
    [MemberData(nameof(InvalidForms))]
    public async Task Invalid_form_returns_400_and_stores_nothing(string reason, Action<Dictionary<string, object?>> change)
    {
        using var client = await StudentClientAsync();
        var response = await SaveAsync(client, Form(change));
        Assert.True(response.StatusCode == HttpStatusCode.BadRequest, reason);
        Assert.Null((await BuscaAsync(client)).Status);
    }

    [Fact]
    public async Task Pcd_data_is_stored_with_the_consent_date_and_the_date_is_renewed_on_later_saves()
    {
        using var client = await StudentClientAsync();
        var before = DateTimeOffset.UtcNow;
        var form = Form(f =>
        {
            f["souPcd"] = true;
            f["interesseVagaPcd"] = true;
            f["tiposDeficiencia"] = new[] { "VISUAL", "FISICA" };
            f["consentimentoPcd"] = true;
        });
        Assert.Equal(HttpStatusCode.NoContent, (await SaveAsync(client, form)).StatusCode);

        var first = (await BuscaAsync(client)).Pcd;
        Assert.True(first.SouPcd);
        Assert.True(first.InteresseVagaPcd);
        Assert.Equal([TipoDeficiencia.FISICA, TipoDeficiencia.VISUAL], first.Tipos);
        Assert.True(first.ConsentimentoEm >= before.AddSeconds(-1));

        await SaveAsync(client, form);
        Assert.True((await BuscaAsync(client)).Pcd.ConsentimentoEm > first.ConsentimentoEm);
    }

    [Fact]
    public async Task Interest_in_pcd_jobs_alone_needs_consent_but_stores_no_disability_type()
    {
        using var client = await StudentClientAsync();
        var response = await SaveAsync(client, Form(f =>
        {
            f["interesseVagaPcd"] = true;
            f["tiposDeficiencia"] = new[] { "TEA" };
            f["consentimentoPcd"] = true;
        }));
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var pcd = (await BuscaAsync(client)).Pcd;
        Assert.False(pcd.SouPcd);
        Assert.True(pcd.InteresseVagaPcd);
        Assert.Empty(pcd.Tipos);
        Assert.NotNull(pcd.ConsentimentoEm);
    }

    [Fact]
    public async Task Clearing_the_pcd_fields_removes_the_types_and_the_consent()
    {
        using var client = await StudentClientAsync();
        await SaveAsync(client, Form(f =>
        {
            f["souPcd"] = true;
            f["interesseVagaPcd"] = true;
            f["tiposDeficiencia"] = new[] { "AUDITIVA" };
            f["consentimentoPcd"] = true;
        }));

        Assert.Equal(HttpStatusCode.NoContent, (await SaveAsync(client, Form())).StatusCode);

        AssertNoPcd((await BuscaAsync(client)).Pcd);
        await factory.InScopeAsync(async provider =>
            Assert.False(await provider.GetRequiredService<AppDbContext>().AlunoTiposDeficiencia.AnyAsync()));
    }

    [Fact]
    public async Task Saving_without_consent_does_not_change_previously_stored_pcd_data()
    {
        using var client = await StudentClientAsync();
        await SaveAsync(client, Form(f =>
        {
            f["souPcd"] = true;
            f["tiposDeficiencia"] = new[] { "VISUAL" };
            f["consentimentoPcd"] = true;
        }));

        var response = await SaveAsync(client, Form(f =>
        {
            f["souPcd"] = true;
            f["tiposDeficiencia"] = new[] { "AUDITIVA" };
        }));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal([TipoDeficiencia.VISUAL], (await BuscaAsync(client)).Pcd.Tipos);
    }

    [Fact]
    public async Task Status_older_than_30_days_is_flagged_as_outdated_by_the_backend()
    {
        using var client = await StudentClientAsync();
        var id = await UserIdAsync(Email);
        await SaveAsync(client, Form());

        await ChangeAlunoAsync(id, x => x.StatusBuscaConfirmadoEm = DateTimeOffset.UtcNow.AddDays(-29));
        Assert.False((await BuscaAsync(client)).StatusDesatualizado);

        await ChangeAlunoAsync(id, x => x.StatusBuscaConfirmadoEm = DateTimeOffset.UtcNow.AddDays(-31));
        var busca = await BuscaAsync(client);
        Assert.True(busca.StatusDesatualizado);
        Assert.Equal(StatusBusca.BUSCANDO_ATIVAMENTE, busca.Status); // still visible, only flagged
    }

    [Fact]
    public async Task Confirm_resets_the_date_without_touching_the_answers()
    {
        using var client = await StudentClientAsync();
        var id = await UserIdAsync(Email);
        await SaveAsync(client, Form(f => f["statusBusca"] = "NAO_BUSCANDO"));
        var old = DateTimeOffset.UtcNow.AddDays(-40);
        await ChangeAlunoAsync(id, x => x.StatusBuscaConfirmadoEm = old);
        Assert.True((await BuscaAsync(client)).StatusDesatualizado);

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync(ConfirmUrl, null)).StatusCode);

        var busca = await BuscaAsync(client);
        Assert.False(busca.StatusDesatualizado);
        Assert.True(busca.StatusConfirmadoEm > old.AddDays(39));
        Assert.Equal(StatusBusca.NAO_BUSCANDO, busca.Status);
        Assert.Equal("Quero atuar com back-end.", busca.Objetivo);
    }

    [Fact]
    public async Task Confirm_without_a_status_returns_409()
    {
        using var client = await StudentClientAsync();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync(ConfirmUrl, null)).StatusCode);
        Assert.Null((await BuscaAsync(client)).StatusConfirmadoEm);
    }

    [Fact]
    public async Task Editing_other_parts_of_the_profile_does_not_reconfirm_the_status()
    {
        using var client = await StudentClientAsync();
        var id = await UserIdAsync(Email);
        await SaveAsync(client, Form());
        var old = DateTimeOffset.UtcNow.AddDays(-40);
        await ChangeAlunoAsync(id, x => x.StatusBuscaConfirmadoEm = old);

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.PutAsJsonAsync("/api/alunos/me/sobre", new { bio = "Novo texto" })).StatusCode);

        var busca = await BuscaAsync(client);
        Assert.True(busca.StatusDesatualizado);
        Assert.True(busca.StatusConfirmadoEm < old.AddMinutes(1));
    }

    [Fact]
    public async Task Limits_are_inclusive_five_areas_and_280_characters()
    {
        using var client = await StudentClientAsync();
        var response = await SaveAsync(client, Form(f =>
        {
            f["areasInteresse"] = new[] { "Redes", "DevOps", "Agilidade", "Inovacao", "PessoasRh" };
            f["objetivoProfissional"] = new string('a', 280);
        }));
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(5, (await BuscaAsync(client)).AreasInteresse.Count);
    }

    [Fact]
    public async Task Old_two_field_payload_is_rejected_and_keeps_the_saved_search()
    {
        using var client = await StudentClientAsync();
        await SaveAsync(client, Form());

        var response = await client.PutAsJsonAsync(AvailabilityUrl, new
        {
            disponibilidades = new[] { "CLT" },
            modalidades = new[] { "HIBRIDO" }
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var busca = await BuscaAsync(client);
        Assert.NotNull(busca.Status);
        Assert.NotNull(busca.Objetivo);
        Assert.NotEmpty(busca.AreasInteresse);
        Assert.NotEmpty(busca.CategoriasCnh);
        Assert.True(busca.AceitaViajar);
        Assert.True(busca.PossuiVeiculoProprio);
    }

    [Theory]
    [InlineData("disponivelImediatamente")]
    [InlineData("aceitaViajar")]
    [InlineData("aceitaMudarDeCidade")]
    [InlineData("possuiVeiculoProprio")]
    [InlineData("souPcd")]
    [InlineData("interesseVagaPcd")]
    [InlineData("consentimentoPcd")]
    public async Task Payload_without_a_required_yes_no_field_is_rejected(string field)
    {
        using var client = await StudentClientAsync();
        Assert.Equal(HttpStatusCode.NoContent, (await SaveAsync(client, Form())).StatusCode);

        Assert.Equal(HttpStatusCode.BadRequest, (await SaveAsync(client, Form(f => f.Remove(field)))).StatusCode);
    }

    [Fact]
    public async Task Consent_without_any_pcd_field_stores_no_consent_date()
    {
        using var client = await StudentClientAsync();
        Assert.Equal(HttpStatusCode.NoContent,
            (await SaveAsync(client, Form(f => f["consentimentoPcd"] = true))).StatusCode);
        AssertNoPcd((await BuscaAsync(client)).Pcd);
    }

    [Fact]
    public async Task Turning_off_sou_pcd_keeps_the_interest_and_consent_but_drops_the_types()
    {
        using var client = await StudentClientAsync();
        await SaveAsync(client, Form(f =>
        {
            f["souPcd"] = true;
            f["interesseVagaPcd"] = true;
            f["tiposDeficiencia"] = new[] { "VISUAL" };
            f["consentimentoPcd"] = true;
        }));

        await SaveAsync(client, Form(f =>
        {
            f["interesseVagaPcd"] = true;
            f["tiposDeficiencia"] = new[] { "VISUAL" };
            f["consentimentoPcd"] = true;
        }));

        var pcd = (await BuscaAsync(client)).Pcd;
        Assert.False(pcd.SouPcd);
        Assert.True(pcd.InteresseVagaPcd);
        Assert.Empty(pcd.Tipos);
        Assert.NotNull(pcd.ConsentimentoEm);
    }

    [Fact]
    public async Task Saving_the_same_form_again_keeps_atualizado_em_but_a_real_change_updates_it()
    {
        using var client = await StudentClientAsync();
        var id = await UserIdAsync(Email);
        await SaveAsync(client, Form());
        var old = DateTimeOffset.UtcNow.AddDays(-5);
        await ChangeAlunoAsync(id, x => x.AtualizadoEm = old);

        await SaveAsync(client, Form());
        var unchanged = (await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!;
        Assert.Equal(old.ToUnixTimeMilliseconds(), unchanged.AtualizadoEm.ToUnixTimeMilliseconds());

        await SaveAsync(client, Form(f => f["aceitaMudarDeCidade"] = true));
        var changed = (await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!;
        Assert.True(changed.AtualizadoEm > old.AddDays(4));
    }

    [Theory]
    [InlineData("areasInteresse", "Redes")]
    [InlineData("disponibilidades", "PJ")]
    [InlineData("categoriasCnh", "C")]
    public async Task Changing_only_one_collection_updates_atualizado_em(string field, string value)
    {
        using var client = await StudentClientAsync();
        var id = await UserIdAsync(Email);
        await SaveAsync(client, Form());
        var old = DateTimeOffset.UtcNow.AddDays(-5);
        await ChangeAlunoAsync(id, x => x.AtualizadoEm = old);

        Assert.Equal(HttpStatusCode.NoContent, (await SaveAsync(client, Form(f => f[field] = new[] { value }))).StatusCode);

        var profile = (await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!;
        Assert.True(profile.AtualizadoEm > old.AddDays(4));
    }

    [Fact]
    public async Task Repeated_availability_types_and_modalities_are_still_accepted()
    {
        using var client = await StudentClientAsync();
        var response = await SaveAsync(client, Form(f =>
        {
            f["disponibilidades"] = new[] { "CLT", "CLT" };
            f["modalidades"] = new[] { "REMOTO", "REMOTO" };
        }));
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var profile = (await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!;
        Assert.Single(profile.Disponibilidades);
        Assert.Single(profile.Modalidades);
    }

    [Theory]
    [InlineData("areasInteresse")]
    [InlineData("categoriasCnh")]
    [InlineData("tiposDeficiencia")]
    public async Task Explicit_null_collection_returns_400_not_500(string field)
    {
        using var client = await StudentClientAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await SaveAsync(client, Form(f => f[field] = null))).StatusCode);
    }

    [Fact]
    public async Task Confirming_the_status_does_not_change_atualizado_em()
    {
        using var client = await StudentClientAsync();
        var id = await UserIdAsync(Email);
        await SaveAsync(client, Form());
        var old = DateTimeOffset.UtcNow.AddDays(-5);
        await ChangeAlunoAsync(id, x => x.AtualizadoEm = old);

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync(ConfirmUrl, null)).StatusCode);

        var profile = (await client.GetFromJsonAsync<MeResponse>("/api/alunos/me", ApiFactory.JsonOptions))!;
        Assert.Equal(old.ToUnixTimeMilliseconds(), profile.AtualizadoEm.ToUnixTimeMilliseconds());
    }

    [Fact]
    public async Task Confirm_requires_csrf_login_and_the_student_role()
    {
        using var anonymous = factory.Client();
        await ApiFactory.SetCsrfAsync(anonymous);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsync(ConfirmUrl, null)).StatusCode);

        using var student = await StudentClientAsync();
        student.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await student.PostAsync(ConfirmUrl, null)).StatusCode);

        await factory.CreateUserAsync("recrutador@example.test", AppRoles.Recruiter);
        using var recruiter = factory.Client();
        await ApiFactory.LoginAsync(recruiter, "recrutador@example.test");
        await ApiFactory.SetCsrfAsync(recruiter);
        Assert.Equal(HttpStatusCode.Forbidden, (await recruiter.PostAsync(ConfirmUrl, null)).StatusCode);
    }

    public void Dispose() => factory.Dispose();
}
