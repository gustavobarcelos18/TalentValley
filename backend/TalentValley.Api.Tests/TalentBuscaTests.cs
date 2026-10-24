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

// "O que eu busco" as recruiters and admins see it: payload, PCD consent defense, filters (EF count + raw SQL page) and comparison.
public sealed class TalentBuscaTests
{
    private static readonly DateTimeOffset Consent = new(2026, 9, 1, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Card_and_profile_carry_the_search_data_and_flag_an_outdated_status()
    {
        using var factory = new ApiFactory();
        using var recruiter = await RecruiterAsync(factory);
        var fresh = await StudentAsync(factory, "Fresh Status", "fresh", student =>
        {
            student.StatusBusca = StatusBusca.BUSCANDO_ATIVAMENTE;
            student.StatusBuscaConfirmadoEm = DateTimeOffset.UtcNow.AddDays(-2);
            student.ObjetivoProfissional = "Estágio em dados";
            student.DisponivelAPartirDe = new DateOnly(2027, 1, 15);
            student.CargaHorariaSemanal = CargaHorariaSemanal.ATE_30H;
            student.AceitaViajar = true;
            student.PossuiVeiculoProprio = true;
        }, areas: [AreaInteresse.DadosAnalytics, AreaInteresse.BancoDeDados], licenses: [CategoriaCnh.B, CategoriaCnh.A]);
        await StudentAsync(factory, "Old Status", "old", student =>
        {
            student.StatusBusca = StatusBusca.NAO_BUSCANDO;
            student.StatusBuscaConfirmadoEm = DateTimeOffset.UtcNow.AddDays(-40);
        });
        await StudentAsync(factory, "No Status", "none");

        var page = (await recruiter.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
            "/api/talentos", ApiFactory.JsonOptions))!;
        var bySlug = page.Items.ToDictionary(x => x.Slug);
        var card = bySlug["fresh"].Busca;
        Assert.Equal(StatusBusca.BUSCANDO_ATIVAMENTE, card.Status);
        Assert.False(card.StatusDesatualizado);
        Assert.Equal("Estágio em dados", card.Objetivo);
        Assert.Equal([AreaInteresse.DadosAnalytics, AreaInteresse.BancoDeDados], card.AreasInteresse);
        Assert.Equal(new DateOnly(2027, 1, 15), card.DisponivelAPartirDe);
        Assert.Equal(CargaHorariaSemanal.ATE_30H, card.CargaHoraria);
        Assert.True(card.AceitaViajar);
        Assert.False(card.AceitaMudarDeCidade);
        Assert.Equal([CategoriaCnh.A, CategoriaCnh.B], card.CategoriasCnh);
        Assert.True(card.PossuiVeiculoProprio);
        Assert.Null(card.Pcd);
        Assert.True(bySlug["old"].Busca.StatusDesatualizado);
        Assert.Equal(StatusBusca.NAO_BUSCANDO, bySlug["old"].Busca.Status);
        Assert.Null(bySlug["none"].Busca.Status);
        Assert.False(bySlug["none"].Busca.StatusDesatualizado);

        var profile = (await recruiter.GetFromJsonAsync<TalentProfileResponse>(
            "/api/talentos/fresh", ApiFactory.JsonOptions))!;
        Assert.Equal(fresh, profile.Id);
        Assert.Equal(card.Objetivo, profile.Busca.Objetivo);
        Assert.Equal(card.AreasInteresse, profile.Busca.AreasInteresse);
        Assert.Equal(card.CategoriasCnh, profile.Busca.CategoriasCnh);
    }

    [Fact]
    public async Task Pcd_is_only_exposed_to_recruiters_and_admins_when_the_student_gave_consent()
    {
        using var factory = new ApiFactory();
        using var recruiter = await RecruiterAsync(factory);
        var adminEmail = $"admin-{Guid.NewGuid():N}@example.test";
        await factory.CreateUserAsync(adminEmail, AppRoles.Admin);
        using var admin = factory.Client();
        await ApiFactory.LoginAsync(admin, adminEmail);
        var shared = await StudentAsync(factory, "Shared Pcd", "shared", student =>
        {
            student.SouPcd = true;
            student.InteresseVagaPcd = true;
            student.ConsentimentoPcdEm = Consent;
        }, deficiencies: [TipoDeficiencia.VISUAL, TipoDeficiencia.AUDITIVA]);
        // A row that somehow has PCD data without the consent date must stay hidden (backend defense).
        var withoutConsent = await StudentAsync(factory, "Hidden Pcd", "hidden-pcd", student =>
        {
            student.SouPcd = true;
            student.InteresseVagaPcd = true;
        }, deficiencies: [TipoDeficiencia.FISICA]);

        var page = (await recruiter.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
            "/api/talentos", ApiFactory.JsonOptions))!;
        var pcd = page.Items.Single(x => x.Slug == "shared").Busca.Pcd!;
        Assert.True(pcd.SouPcd);
        Assert.True(pcd.InteresseVagaPcd);
        Assert.Equal([TipoDeficiencia.VISUAL, TipoDeficiencia.AUDITIVA], pcd.Tipos);
        Assert.Null(page.Items.Single(x => x.Slug == "hidden-pcd").Busca.Pcd);

        var hiddenProfile = await recruiter.GetStringAsync("/api/talentos/hidden-pcd");
        Assert.DoesNotContain("FISICA", hiddenProfile);
        Assert.Null((await recruiter.GetFromJsonAsync<TalentProfileResponse>(
            "/api/talentos/hidden-pcd", ApiFactory.JsonOptions))!.Busca.Pcd);
        Assert.NotNull((await recruiter.GetFromJsonAsync<TalentProfileResponse>(
            "/api/talentos/shared", ApiFactory.JsonOptions))!.Busca.Pcd);

        var adminShared = (await admin.GetFromJsonAsync<AdminAlunoDetailResponse>(
            $"/api/admin/alunos/{shared}", ApiFactory.JsonOptions))!;
        Assert.Equal([TipoDeficiencia.VISUAL, TipoDeficiencia.AUDITIVA], adminShared.Busca.Pcd!.Tipos);
        var adminHidden = (await admin.GetFromJsonAsync<AdminAlunoDetailResponse>(
            $"/api/admin/alunos/{withoutConsent}", ApiFactory.JsonOptions))!;
        Assert.Null(adminHidden.Busca.Pcd);

        var comparison = await recruiter.GetStringAsync("/api/recrutador/comparar?slugs=shared&slugs=hidden-pcd");
        Assert.DoesNotContain("FISICA", comparison);
    }

    [Fact]
    public async Task Search_filters_use_or_within_groups_and_and_between_groups_on_count_and_page()
    {
        using var factory = new ApiFactory();
        using var recruiter = await RecruiterAsync(factory);
        await StudentAsync(factory, "Ana Ativa", "ana", student =>
        {
            student.StatusBusca = StatusBusca.BUSCANDO_ATIVAMENTE;
            student.AceitaViajar = true;
        }, areas: [AreaInteresse.DesenvolvimentoBackend], licenses: [CategoriaCnh.B]);
        await StudentAsync(factory, "Bruno Aberto", "bruno", student =>
        {
            student.StatusBusca = StatusBusca.ABERTO_A_PROPOSTAS;
            student.AceitaMudarDeCidade = true;
        }, areas: [AreaInteresse.DesenvolvimentoFrontend, AreaInteresse.DevOps], licenses: [CategoriaCnh.D]);
        await StudentAsync(factory, "Carla Parada", "carla", student =>
        {
            student.StatusBusca = StatusBusca.NAO_BUSCANDO;
            student.AceitaViajar = true;
            student.AceitaMudarDeCidade = true;
            student.InteresseVagaPcd = true;
            student.SouPcd = true;
            student.ConsentimentoPcdEm = Consent;
        }, areas: [AreaInteresse.DevOps], licenses: [CategoriaCnh.B, CategoriaCnh.E],
            deficiencies: [TipoDeficiencia.TEA]);
        await StudentAsync(factory, "Davi Sem", "davi");
        await StudentAsync(factory, "Eva Pcd Sem Aceite", "eva", student =>
        {
            student.InteresseVagaPcd = true;
        });

        Assert.Equal(["ana", "carla"], await SlugsAsync(recruiter, "statusBusca=BUSCANDO_ATIVAMENTE&statusBusca=NAO_BUSCANDO"));
        Assert.Equal(["bruno", "carla"], await SlugsAsync(recruiter, "areasInteresse=DevOps"));
        Assert.Equal(["bruno", "carla"], await SlugsAsync(recruiter, "areasInteresse=DevOps&areasInteresse=DesenvolvimentoFrontend"));
        Assert.Equal(["ana", "carla"], await SlugsAsync(recruiter, "aceitaViajar=true"));
        Assert.Equal(["bruno", "carla"], await SlugsAsync(recruiter, "aceitaMudarDeCidade=true"));
        Assert.Equal(["carla"], await SlugsAsync(recruiter, "aceitaViajar=true&aceitaMudarDeCidade=true"));
        Assert.Equal(["ana", "carla"], await SlugsAsync(recruiter, "categoriasCnh=B"));
        Assert.Equal(["ana", "bruno", "carla"], await SlugsAsync(recruiter, "categoriasCnh=B&categoriasCnh=D"));
        Assert.Equal(["carla"], await SlugsAsync(recruiter, "categoriasCnh=E"));
        // Interest in PCD jobs only filters students who shared it with the consent box.
        Assert.Equal(["carla"], await SlugsAsync(recruiter, "interesseVagaPcd=true"));
        Assert.Equal(["carla"], await SlugsAsync(recruiter, "areasInteresse=DevOps&categoriasCnh=B&statusBusca=NAO_BUSCANDO"));
        Assert.Empty(await SlugsAsync(recruiter, "areasInteresse=DesenvolvimentoBackend&aceitaMudarDeCidade=true"));
        // False and absent mean "no filter".
        Assert.Equal(5, (await SearchAsync(recruiter, "aceitaViajar=false&interesseVagaPcd=false")).TotalItems);
    }

    [Fact]
    public async Task Search_rejects_undefined_values_of_the_new_filters()
    {
        using var factory = new ApiFactory();
        using var recruiter = await RecruiterAsync(factory);

        foreach (var query in new[] { "statusBusca=99", "areasInteresse=999", "categoriasCnh=Z", "categoriasCnh=7", "aceitaViajar=talvez" })
            Assert.Equal(HttpStatusCode.BadRequest, (await recruiter.GetAsync($"/api/talentos?{query}")).StatusCode);
    }

    [Fact]
    public async Task Comparison_returns_only_the_areas_and_license_categories_both_students_share()
    {
        using var factory = new ApiFactory();
        using var recruiter = await RecruiterAsync(factory);
        await StudentAsync(factory, "Primeiro", "primeiro", student => student.AceitaViajar = true,
            areas: [AreaInteresse.DevOps, AreaInteresse.Redes, AreaInteresse.DadosAnalytics],
            licenses: [CategoriaCnh.A, CategoriaCnh.B]);
        await StudentAsync(factory, "Segundo", "segundo", student => student.AceitaViajar = true,
            areas: [AreaInteresse.Redes, AreaInteresse.DevOps, AreaInteresse.Audiovisual],
            licenses: [CategoriaCnh.B, CategoriaCnh.C]);

        var result = (await recruiter.GetFromJsonAsync<TalentComparisonResponse>(
            "/api/recrutador/comparar?slugs=primeiro&slugs=segundo", ApiFactory.JsonOptions))!;
        Assert.Equal([AreaInteresse.DevOps, AreaInteresse.Redes], result.EmComum.AreasInteresse);
        Assert.Equal([CategoriaCnh.B], result.EmComum.CategoriasCnh);
        Assert.Equal(3, result.TalentoA.Busca.AreasInteresse.Count);
        Assert.True(result.TalentoB.Busca.AceitaViajar);
    }

    private static async Task<HttpClient> RecruiterAsync(ApiFactory factory)
    {
        var email = $"recruiter-{Guid.NewGuid():N}@example.test";
        await factory.CreateUserAsync(email, AppRoles.Recruiter);
        var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, email)).StatusCode);
        return client;
    }

    private static async Task<PaginatedResponse<TalentListItem>> SearchAsync(HttpClient client, string query) =>
        (await client.GetFromJsonAsync<PaginatedResponse<TalentListItem>>($"/api/talentos?{query}", ApiFactory.JsonOptions))!;

    private static async Task<string[]> SlugsAsync(HttpClient client, string query)
    {
        var result = await SearchAsync(client, query);
        // The count comes from the EF query and the page from the raw SQL: both must agree.
        Assert.Equal(result.TotalItems, result.Items.Count);
        return result.Items.Select(x => x.Slug).Order().ToArray();
    }

    private static async Task<Guid> StudentAsync(ApiFactory factory, string name, string slug,
        Action<Aluno>? configure = null, AreaInteresse[]? areas = null, CategoriaCnh[]? licenses = null,
        TipoDeficiencia[]? deficiencies = null)
    {
        var id = await factory.CreateUserAsync($"{slug}-{Guid.NewGuid():N}@example.test");
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var user = await db.Users.SingleAsync(x => x.Id == id);
            var student = await db.Alunos.SingleAsync(x => x.UserId == id);
            user.NomeCompleto = name;
            user.NomeBusca = NameNormalizer.Normalize(name);
            student.Slug = slug;
            student.AtualizadoEm = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
            configure?.Invoke(student);
            foreach (var area in areas ?? [])
                db.AlunoAreasInteresse.Add(new() { AlunoId = id, Area = area });
            foreach (var license in licenses ?? [])
                db.AlunoCategoriasCnh.Add(new() { AlunoId = id, Categoria = license });
            foreach (var deficiency in deficiencies ?? [])
                db.AlunoTiposDeficiencia.Add(new() { AlunoId = id, Tipo = deficiency });
            await db.SaveChangesAsync();
        });
        return id;
    }
}
