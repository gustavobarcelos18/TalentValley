using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Tests;

public sealed class RecruiterPhase9Tests
{
    [Fact]
    public async Task Phase9_endpoints_require_active_recruiter_and_mutations_require_csrf()
    {
        using var factory = new ApiFactory();
        var studentEmail = Email("student");
        await factory.CreateUserAsync(studentEmail);
        var adminEmail = Email("admin");
        await factory.CreateUserAsync(adminEmail, AppRoles.Admin);
        var blockedEmail = Email("blocked");
        await factory.CreateUserAsync(blockedEmail, AppRoles.Recruiter, active: false);
        var recruiterEmail = Email("recruiter");
        var recruiterId = await factory.CreateUserAsync(recruiterEmail, AppRoles.Recruiter);
        await StudentAsync(factory, "Active", "active");

        foreach (var path in new[] { "/api/recrutador/favoritos", "/api/recrutador/comparar", "/api/recrutador/dashboard" })
        {
            using var anonymous = factory.Client();
            Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(path)).StatusCode);
            using var student = factory.Client();
            await ApiFactory.LoginAsync(student, studentEmail);
            Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync(path)).StatusCode);
            using var admin = factory.Client();
            await ApiFactory.LoginAsync(admin, adminEmail);
            Assert.Equal(HttpStatusCode.Forbidden, (await admin.GetAsync(path)).StatusCode);
        }

        using var blocked = factory.Client();
        Assert.Equal(HttpStatusCode.Forbidden, (await ApiFactory.LoginAsync(blocked, blockedEmail)).StatusCode);
        using var recruiter = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(recruiter, recruiterEmail)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await recruiter.PostAsync("/api/recrutador/favoritos/active", null)).StatusCode);
        await ApiFactory.SetCsrfAsync(recruiter);
        Assert.Equal(HttpStatusCode.NoContent,
            (await recruiter.PostAsync("/api/recrutador/favoritos/active", null)).StatusCode);

        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            (await db.Recrutadores.SingleAsync(x => x.UserId == recruiterId)).Status = StatusRecrutador.BLOQUEADO;
            await db.SaveChangesAsync();
        });
        Assert.Equal(HttpStatusCode.Forbidden, (await recruiter.GetAsync("/api/recrutador/favoritos")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await recruiter.GetAsync("/api/recrutador/dashboard")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await recruiter.GetAsync("/api/recrutador/comparar?slugs=a&slugs=b")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await recruiter.DeleteAsync("/api/recrutador/favoritos/active")).StatusCode);
    }

    [Fact]
    public async Task Favorites_are_idempotent_isolated_paginated_and_survive_student_blocking()
    {
        using var factory = new ApiFactory();
        var a = await RecruiterAsync(factory, "a");
        var b = await RecruiterAsync(factory, "b");
        var target = await StudentAsync(factory, "Target", "target");

        Assert.Equal(HttpStatusCode.NoContent,
            (await a.Client.PostAsync("/api/recrutador/favoritos/target", null)).StatusCode);
        DateTimeOffset created = default;
        await factory.InScopeAsync(async services => created =
            (await services.GetRequiredService<AppDbContext>().Favoritos.AsNoTracking().SingleAsync()).CriadoEm);
        Assert.Equal(HttpStatusCode.NoContent,
            (await a.Client.PostAsync("/api/recrutador/favoritos/target", null)).StatusCode);
        await factory.InScopeAsync(async services =>
        {
            var rows = await services.GetRequiredService<AppDbContext>().Favoritos.AsNoTracking().ToListAsync();
            var row = Assert.Single(rows);
            Assert.Equal(a.Id, row.RecrutadorId);
            Assert.Equal(target, row.AlunoId);
            Assert.Equal(created, row.CriadoEm);
        });
        Assert.Empty((await b.Client.GetFromJsonAsync<PaginatedResponse<FavoriteTalentResponse>>(
            "/api/recrutador/favoritos", ApiFactory.JsonOptions))!.Items);
        Assert.Equal(HttpStatusCode.NoContent,
            (await b.Client.PostAsync("/api/recrutador/favoritos/target", null)).StatusCode);

        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            Assert.Equal(2, await db.Favoritos.CountAsync());
            (await db.Alunos.SingleAsync(x => x.UserId == target)).Ativo = false;
            await db.SaveChangesAsync();
        });
        Assert.Empty((await a.Client.GetFromJsonAsync<PaginatedResponse<FavoriteTalentResponse>>(
            "/api/recrutador/favoritos", ApiFactory.JsonOptions))!.Items);
        Assert.Equal(0, (await a.Client.GetFromJsonAsync<RecruiterDashboardResponse>(
            "/api/recrutador/dashboard", ApiFactory.JsonOptions))!.Indicadores.Favoritos);
        Assert.Equal(HttpStatusCode.NotFound,
            (await a.Client.PostAsync("/api/recrutador/favoritos/target", null)).StatusCode);

        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            (await db.Alunos.SingleAsync(x => x.UserId == target)).Ativo = true;
            await db.SaveChangesAsync();
        });
        var restored = Assert.Single((await a.Client.GetFromJsonAsync<PaginatedResponse<FavoriteTalentResponse>>(
            "/api/recrutador/favoritos", ApiFactory.JsonOptions))!.Items);
        Assert.Equal(created, restored.FavoritadoEm);

        Assert.Equal(HttpStatusCode.NoContent,
            (await a.Client.DeleteAsync("/api/recrutador/favoritos/target")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await a.Client.DeleteAsync("/api/recrutador/favoritos/target")).StatusCode);
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            Assert.False(await db.Favoritos.AnyAsync(x => x.RecrutadorId == a.Id));
            Assert.True(await db.Favoritos.AnyAsync(x => x.RecrutadorId == b.Id));
        });
        Assert.Equal(HttpStatusCode.NotFound,
            (await a.Client.DeleteAsync("/api/recrutador/favoritos/unknown")).StatusCode);
    }

    [Fact]
    public async Task Concurrent_duplicate_adds_converge_and_search_detail_are_contextual_without_reordering()
    {
        using var factory = new ApiFactory();
        var email = Email("recruiter");
        var recruiterId = await factory.CreateUserAsync(email, AppRoles.Recruiter);
        using var first = factory.Client();
        using var second = factory.Client();
        await ApiFactory.LoginAsync(first, email);
        await ApiFactory.LoginAsync(second, email);
        await ApiFactory.SetCsrfAsync(first);
        await ApiFactory.SetCsrfAsync(second);
        var target = await StudentAsync(factory, "Zulu", "zulu", new(2026, 1, 2, 0, 0, 0, TimeSpan.Zero));
        await StudentAsync(factory, "Alpha", "alpha", new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));

        var responses = await Task.WhenAll(
            first.PostAsync("/api/recrutador/favoritos/zulu", null),
            second.PostAsync("/api/recrutador/favoritos/zulu", null));
        Assert.All(responses, x => Assert.Equal(HttpStatusCode.NoContent, x.StatusCode));
        await factory.InScopeAsync(async services => Assert.Equal(1,
            await services.GetRequiredService<AppDbContext>().Favoritos.CountAsync(
                x => x.RecrutadorId == recruiterId && x.AlunoId == target)));

        var page = await first.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
            "/api/talentos", ApiFactory.JsonOptions);
        Assert.Equal(new[] { "zulu", "alpha" }, page!.Items.Select(x => x.Slug));
        Assert.True(page.Items.First().Favorito);
        Assert.False(page.Items.Last().Favorito);
        Assert.True((await first.GetFromJsonAsync<TalentProfileResponse>(
            "/api/talentos/zulu", ApiFactory.JsonOptions))!.Favorito);

        var other = await RecruiterAsync(factory, "other");
        Assert.False((await other.Client.GetFromJsonAsync<TalentProfileResponse>(
            "/api/talentos/zulu", ApiFactory.JsonOptions))!.Favorito);

        Assert.Equal(HttpStatusCode.NoContent,
            (await first.DeleteAsync("/api/recrutador/favoritos/zulu")).StatusCode);
        Assert.False((await first.GetFromJsonAsync<TalentProfileResponse>(
            "/api/talentos/zulu", ApiFactory.JsonOptions))!.Favorito);
        Assert.False((await first.GetFromJsonAsync<PaginatedResponse<TalentListItem>>(
            "/api/talentos", ApiFactory.JsonOptions))!.Items.Single(x => x.Id == target).Favorito);
    }

    [Fact]
    public async Task Comparison_requires_exactly_two_active_distinct_talents_and_returns_neutral_common_data()
    {
        using var factory = new ApiFactory();
        var recruiter = await RecruiterAsync(factory, "compare");
        var a = await StudentAsync(factory, "Talent A", "a");
        var b = await StudentAsync(factory, "Talent B", "b");
        await StudentAsync(factory, "Hidden", "hidden", active: false);
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var common = new Competencia { Nome = "React Phase 9", NomeBusca = "react phase 9" };
            var exclusive = new Competencia { Nome = "C# Phase 9", NomeBusca = "c# phase 9" };
            var projectOnly = new Competencia { Nome = "Docker Phase 9", NomeBusca = "docker phase 9" };
            db.Competencias.AddRange(common, exclusive, projectOnly);
            await db.SaveChangesAsync();
            db.AlunoCompetencias.AddRange(
                new() { AlunoId = a, CompetenciaId = common.Id },
                new() { AlunoId = b, CompetenciaId = common.Id },
                new() { AlunoId = a, CompetenciaId = exclusive.Id });
            db.AlunoDisponibilidades.AddRange(
                new() { AlunoId = a, Tipo = TipoDisponibilidade.CLT },
                new() { AlunoId = b, Tipo = TipoDisponibilidade.CLT });
            db.AlunoModalidades.AddRange(
                new() { AlunoId = a, Modalidade = ModalidadeTrabalho.REMOTO },
                new() { AlunoId = b, Modalidade = ModalidadeTrabalho.REMOTO });
            AddProject(db, a, projectOnly.Id);
            AddProject(db, b, projectOnly.Id);
            await db.SaveChangesAsync();
        });

        Assert.Equal(HttpStatusCode.BadRequest, (await recruiter.Client.GetAsync("/api/recrutador/comparar")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await recruiter.Client.GetAsync("/api/recrutador/comparar?slugs=a")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await recruiter.Client.GetAsync("/api/recrutador/comparar?slugs=a&slugs=a")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await recruiter.Client.GetAsync("/api/recrutador/comparar?slugs=a&slugs=b&slugs=c")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await recruiter.Client.GetAsync("/api/recrutador/comparar?slugs=a&slugs=hidden")).StatusCode);

        var response = await recruiter.Client.GetAsync("/api/recrutador/comparar?slugs=b&slugs=a");
        response.EnsureSuccessStatusCode();
        var comparison = await response.Content.ReadFromJsonAsync<TalentComparisonResponse>(ApiFactory.JsonOptions);
        Assert.Equal("b", comparison!.TalentoA.Slug);
        Assert.Equal("a", comparison.TalentoB.Slug);
        Assert.Equal("React Phase 9", Assert.Single(comparison.EmComum.Competencias).Nome);
        Assert.Equal(TipoDisponibilidade.CLT, Assert.Single(comparison.EmComum.Disponibilidades));
        Assert.Equal(ModalidadeTrabalho.REMOTO, Assert.Single(comparison.EmComum.Modalidades));
        Assert.DoesNotContain(comparison.EmComum.Competencias, x => x.Nome == "Docker Phase 9");
        Assert.False(comparison.TalentoA.Favorito);
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            Assert.Empty(await db.Favoritos.ToListAsync());
            Assert.Empty(await db.Auditorias.ToListAsync());
        });
        var json = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("winner", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("score", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("recommend", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("storageKey", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Dashboard_uses_exact_previous_login_boundary_and_active_only_metrics()
    {
        using var factory = new ApiFactory();
        var recruiter = await RecruiterAsync(factory, "dashboard");
        var firstLogin = await recruiter.Client.GetFromJsonAsync<RecruiterDashboardResponse>(
            "/api/recrutador/dashboard", ApiFactory.JsonOptions);
        Assert.Null(firstLogin!.DesdeUltimoAcesso);
        Assert.Equal(0, firstLogin.Indicadores.PerfisAtualizadosDesdeUltimoAcesso);
        Assert.Equal(0, firstLogin.Indicadores.NovosAlunosDesdeUltimoAcesso);

        var boundary = new DateTimeOffset(2026, 6, 1, 12, 0, 0, TimeSpan.Zero);
        var old = await StudentAsync(factory, "Old", "old", boundary.AddDays(-1));
        var updated = await StudentAsync(factory, "Updated", "updated", boundary.AddMinutes(1));
        var inactive = await StudentAsync(factory, "Inactive", "inactive", boundary.AddMinutes(2), active: false);
        var recentIds = new List<Guid>();
        for (var i = 0; i < 6; i++)
            recentIds.Add(await StudentAsync(factory, $"Recent {i}", $"recent-{i}", boundary.AddDays(-1)));
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var user = await db.Users.SingleAsync(x => x.Id == recruiter.Id);
            user.LoginAnteriorEm = boundary;
            user.UltimoLoginEm = boundary.AddHours(1);
            (await db.Users.SingleAsync(x => x.Id == old)).CriadoEm = boundary.AddDays(-2);
            (await db.Users.SingleAsync(x => x.Id == updated)).CriadoEm = boundary.AddMinutes(1);
            (await db.Users.SingleAsync(x => x.Id == inactive)).CriadoEm = boundary.AddMinutes(2);
            foreach (var id in recentIds)
                (await db.Users.SingleAsync(x => x.Id == id)).CriadoEm = boundary.AddDays(-2);
            db.Favoritos.AddRange(
                new() { RecrutadorId = recruiter.Id, AlunoId = updated, CriadoEm = boundary.AddMinutes(3) },
                new() { RecrutadorId = recruiter.Id, AlunoId = inactive, CriadoEm = boundary.AddMinutes(4) });
            db.Favoritos.AddRange(recentIds.Select((id, index) => new Favorito
                { RecrutadorId = recruiter.Id, AlunoId = id, CriadoEm = boundary.AddMinutes(5 + index) }));
            await db.SaveChangesAsync();
        });

        var result = await recruiter.Client.GetFromJsonAsync<RecruiterDashboardResponse>(
            "/api/recrutador/dashboard", ApiFactory.JsonOptions);
        Assert.Equal(boundary, result!.DesdeUltimoAcesso);
        Assert.Equal(1, result.Indicadores.PerfisAtualizadosDesdeUltimoAcesso);
        Assert.Equal(1, result.Indicadores.NovosAlunosDesdeUltimoAcesso);
        Assert.Equal(7, result.Indicadores.Favoritos);
        Assert.Equal(5, result.FavoritosRecentes.Count);
        Assert.Equal(recentIds.AsEnumerable().Reverse().Take(5), result.FavoritosRecentes.Select(x => x.Talento.Id));
        await factory.InScopeAsync(async services =>
        {
            var user = await services.GetRequiredService<AppDbContext>().Users.AsNoTracking()
                .SingleAsync(x => x.Id == recruiter.Id);
            Assert.Equal(boundary, user.LoginAnteriorEm);
            Assert.Equal(boundary.AddHours(1), user.UltimoLoginEm);
        });
    }

    [Fact]
    public async Task Favorite_list_has_fixed_page_size_deterministic_order_safe_data_and_delete_cascades()
    {
        using var factory = new ApiFactory();
        var recruiter = await RecruiterAsync(factory, "paging");
        var ids = new List<Guid>();
        for (var i = 0; i < 12; i++)
            ids.Add(await StudentAsync(factory, $"Person {i:00}", $"person-{i:00}"));
        var stamp = new DateTimeOffset(2026, 7, 1, 0, 0, 0, TimeSpan.Zero);
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            db.Favoritos.AddRange(ids.Select(id => new Favorito
                { RecrutadorId = recruiter.Id, AlunoId = id, CriadoEm = stamp }));
            (await db.Alunos.SingleAsync(x => x.UserId == ids[0])).FotoStorageKey = "secret-photo-key";
            (await db.Users.SingleAsync(x => x.Id == ids[0])).Email = "identity-secret@example.test";
            await db.SaveChangesAsync();
        });

        var page1Response = await recruiter.Client.GetAsync("/api/recrutador/favoritos");
        var page1 = await page1Response.Content.ReadFromJsonAsync<PaginatedResponse<FavoriteTalentResponse>>(ApiFactory.JsonOptions);
        Assert.Equal(10, page1!.PageSize);
        Assert.Equal(12, page1.TotalItems);
        Assert.Equal(2, page1.TotalPages);
        Assert.Equal(Enumerable.Range(0, 10).Select(i => $"Person {i:00}"), page1.Items.Select(x => x.Talento.NomeCompleto));
        Assert.All(page1.Items, x => Assert.True(x.Talento.Favorito));
        var json = await page1Response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("secret-photo-key", json);
        Assert.DoesNotContain("identity-secret@example.test", json);
        Assert.Equal(2, (await recruiter.Client.GetFromJsonAsync<PaginatedResponse<FavoriteTalentResponse>>(
            "/api/recrutador/favoritos?page=2", ApiFactory.JsonOptions))!.Items.Count);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await recruiter.Client.GetAsync("/api/recrutador/favoritos?page=0")).StatusCode);

        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            db.Alunos.Remove(await db.Alunos.SingleAsync(x => x.UserId == ids[0]));
            await db.SaveChangesAsync();
            Assert.False(await db.Favoritos.AnyAsync(x => x.AlunoId == ids[0]));
        });
    }

    private static async Task<(HttpClient Client, Guid Id)> RecruiterAsync(ApiFactory factory, string prefix)
    {
        var email = Email(prefix);
        var id = await factory.CreateUserAsync(email, AppRoles.Recruiter);
        var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, email)).StatusCode);
        await ApiFactory.SetCsrfAsync(client);
        return (client, id);
    }

    private static async Task<Guid> StudentAsync(ApiFactory factory, string name, string slug,
        DateTimeOffset? updatedAt = null, bool active = true)
    {
        var id = await factory.CreateUserAsync(Email(slug), active: active);
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var user = await db.Users.SingleAsync(x => x.Id == id);
            var student = await db.Alunos.SingleAsync(x => x.UserId == id);
            user.NomeCompleto = name;
            user.NomeBusca = NameNormalizer.Normalize(name);
            student.Slug = slug;
            student.Cidade = "Rio Pomba";
            student.Uf = "MG";
            student.AtualizadoEm = updatedAt ?? new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
            await db.SaveChangesAsync();
        });
        return id;
    }

    private static void AddProject(AppDbContext db, Guid studentId, int competencyId)
    {
        var project = new Projeto
        {
            Id = Guid.NewGuid(), AlunoId = studentId, Ordem = 1, Nome = "Project", Descricao = "Description",
            DataInicio = new(2026, 1, 1), EmAndamento = true
        };
        db.Projetos.Add(project);
        db.ProjetoCompetencias.Add(new() { ProjetoId = project.Id, CompetenciaId = competencyId });
    }

    private static string Email(string prefix) => $"{prefix}-{Guid.NewGuid():N}@example.test";
}
