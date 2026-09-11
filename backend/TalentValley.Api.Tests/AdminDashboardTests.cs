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

public sealed class AdminDashboardTests : IDisposable
{
    private readonly ApiFactory factory = new();

    private static string Email(string prefix) => $"{prefix}-{Guid.NewGuid():N}@example.test";

    private async Task<HttpClient> AdminAsync()
    {
        var adminEmail = Email("admin");
        await factory.CreateUserAsync(adminEmail, AppRoles.Admin);
        var client = factory.Client();
        await ApiFactory.LoginAsync(client, adminEmail);
        await ApiFactory.SetCsrfAsync(client);
        return client;
    }

    private async Task<Guid> CreateStudentAsync(string name, string slug, bool active = true,
        DateTimeOffset? updatedAt = null)
    {
        var email = Email(slug);
        var id = await factory.CreateUserAsync(email, AppRoles.Student, active);
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var student = await db.Alunos.SingleAsync(x => x.UserId == id);
            var user = await db.Users.SingleAsync(x => x.Id == id);
            user.NomeCompleto = name;
            user.NomeBusca = NameNormalizer.Normalize(name);
            student.Slug = slug;
            student.AtualizadoEm = updatedAt ?? new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
            await db.SaveChangesAsync();
        });
        return id;
    }

    private async Task<Guid> CreateRecruiterAsync(string prefix, bool active = true)
    {
        var email = Email(prefix);
        var id = await factory.CreateUserAsync(email, AppRoles.Recruiter, active);
        if (!active)
        {
            await factory.InScopeAsync(async services =>
            {
                var db = services.GetRequiredService<AppDbContext>();
                var recruiter = await db.Recrutadores.SingleAsync(x => x.UserId == id);
                recruiter.Status = StatusRecrutador.BLOQUEADO;
                await db.SaveChangesAsync();
            });
        }
        return id;
    }

    private async Task AddCompetencyToStudentAsync(Guid studentId, int competencyId)
    {
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            db.AlunoCompetencias.Add(new AlunoCompetencia { AlunoId = studentId, CompetenciaId = competencyId });
            await db.SaveChangesAsync();
        });
    }

    private async Task AddProjectToStudentAsync(Guid studentId, int competencyId)
    {
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var project = new Projeto
            {
                Id = Guid.NewGuid(),
                AlunoId = studentId,
                Ordem = 1,
                Nome = "Project",
                Descricao = "Description",
                DataInicio = new DateOnly(2026, 1, 1),
                EmAndamento = true
            };
            db.Projetos.Add(project);
            db.ProjetoCompetencias.Add(new ProjetoCompetencia { ProjetoId = project.Id, CompetenciaId = competencyId });
            await db.SaveChangesAsync();
        });
    }

    private async Task AddFormacaoAsync(Guid studentId, bool ehRioPombaValley, StatusValidacaoRpv? status)
    {
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            db.Formacoes.Add(new Formacao
            {
                Id = Guid.NewGuid(),
                AlunoId = studentId,
                Tipo = TipoFormacao.GRADUACAO,
                Nome = "Course",
                NomeBusca = "course",
                Instituicao = "Institute",
                DataInicio = new DateOnly(2020, 1, 1),
                DataFim = new DateOnly(2024, 12, 31),
                Status = StatusFormacao.CONCLUIDO,
                EhRioPombaValley = ehRioPombaValley,
                StatusValidacaoRpv = status,
                AtualizadoEm = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero)
            });
            await db.SaveChangesAsync();
        });
    }

    private async Task<AdminDashboardResponse> GetDashboardAsync()
    {
        using var client = await AdminAsync();
        return (await client.GetFromJsonAsync<AdminDashboardResponse>("/api/admin/dashboard", ApiFactory.JsonOptions))!;
    }

    [Fact]
    public async Task Dashboard_requires_admin_role()
    {
        using var anonymous = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/admin/dashboard")).StatusCode);

        var studentEmail = Email("student");
        await factory.CreateUserAsync(studentEmail, AppRoles.Student);
        using var student = factory.Client();
        await ApiFactory.LoginAsync(student, studentEmail);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync("/api/admin/dashboard")).StatusCode);

        var recruiterEmail = Email("recruiter");
        await factory.CreateUserAsync(recruiterEmail, AppRoles.Recruiter);
        using var recruiter = factory.Client();
        await ApiFactory.LoginAsync(recruiter, recruiterEmail);
        Assert.Equal(HttpStatusCode.Forbidden, (await recruiter.GetAsync("/api/admin/dashboard")).StatusCode);

        using var admin = await AdminAsync();
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/dashboard")).StatusCode);
    }

    [Fact]
    public async Task Active_students_are_counted()
    {
        await CreateStudentAsync("Student One", "one", active: true);
        await CreateStudentAsync("Student Two", "two", active: true);

        var dashboard = await GetDashboardAsync();
        Assert.Equal(2, dashboard.AlunosAtivos);
    }

    [Fact]
    public async Task Blocked_student_is_excluded_from_active_count()
    {
        await CreateStudentAsync("Active Student", "active", active: true);
        await CreateStudentAsync("Blocked Student", "blocked", active: false);

        var dashboard = await GetDashboardAsync();
        Assert.Equal(1, dashboard.AlunosAtivos);
    }

    [Fact]
    public async Task Active_recruiters_are_counted()
    {
        await CreateRecruiterAsync("recruiter-a", active: true);
        await CreateRecruiterAsync("recruiter-b", active: true);

        var dashboard = await GetDashboardAsync();
        Assert.Equal(2, dashboard.RecrutadoresAtivos);
    }

    [Fact]
    public async Task Blocked_recruiter_is_excluded_from_active_count()
    {
        await CreateRecruiterAsync("recruiter-active", active: true);
        await CreateRecruiterAsync("recruiter-blocked", active: false);

        var dashboard = await GetDashboardAsync();
        Assert.Equal(1, dashboard.RecrutadoresAtivos);
    }

    [Fact]
    public async Task Pending_rpv_validations_are_counted()
    {
        var studentId = await CreateStudentAsync("RPV Student", "rpv", active: true);
        await AddFormacaoAsync(studentId, ehRioPombaValley: true, status: StatusValidacaoRpv.PENDENTE);
        await AddFormacaoAsync(studentId, ehRioPombaValley: true, status: StatusValidacaoRpv.PENDENTE);

        var dashboard = await GetDashboardAsync();
        Assert.Equal(2, dashboard.ValidacoesRpvPendentes);
    }

    [Fact]
    public async Task Verified_rpv_count_is_returned()
    {
        var studentId = await CreateStudentAsync("RPV Student 2", "rpv2", active: true);
        await AddFormacaoAsync(studentId, ehRioPombaValley: true, status: StatusValidacaoRpv.VERIFICADO);
        await AddFormacaoAsync(studentId, ehRioPombaValley: true, status: StatusValidacaoRpv.VERIFICADO);
        await AddFormacaoAsync(studentId, ehRioPombaValley: true, status: StatusValidacaoRpv.VERIFICADO);

        var dashboard = await GetDashboardAsync();
        Assert.Equal(3, dashboard.FormacoesRpvVerificadas);
    }

    [Fact]
    public async Task Profile_updated_inside_7_day_window_is_counted()
    {
        await CreateStudentAsync("Recent Student", "recent", active: true, updatedAt: DateTimeOffset.UtcNow.AddDays(-3));

        var dashboard = await GetDashboardAsync();
        Assert.Equal(1, dashboard.PerfisAtualizadosUltimos7Dias);
    }

    [Fact]
    public async Task Profile_outside_7_day_window_is_excluded()
    {
        await CreateStudentAsync("Old Student", "old", active: true, updatedAt: DateTimeOffset.UtcNow.AddDays(-10));

        var dashboard = await GetDashboardAsync();
        Assert.Equal(0, dashboard.PerfisAtualizadosUltimos7Dias);
    }

    [Fact]
    public async Task Profile_updated_near_7_day_boundary_counts()
    {
        await CreateStudentAsync("Boundary Student", "boundary", active: true,
            updatedAt: DateTimeOffset.UtcNow.AddDays(-7).Add(TimeSpan.FromMinutes(10)));

        var dashboard = await GetDashboardAsync();
        Assert.Equal(1, dashboard.PerfisAtualizadosUltimos7Dias);
    }

    [Fact]
    public async Task Inactive_profile_is_excluded_even_when_recently_updated()
    {
        await CreateStudentAsync("Inactive Recent", "inactive-recent", active: false, updatedAt: DateTimeOffset.UtcNow.AddDays(-1));

        var dashboard = await GetDashboardAsync();
        Assert.Equal(0, dashboard.PerfisAtualizadosUltimos7Dias);
    }

    [Fact]
    public async Task Pure_admin_rpv_validation_does_not_fake_profile_update()
    {
        var studentId = await CreateStudentAsync("Clean Student", "clean", active: true,
            updatedAt: new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));
        await AddFormacaoAsync(studentId, ehRioPombaValley: true, status: StatusValidacaoRpv.VERIFICADO);

        var dashboard = await GetDashboardAsync();
        Assert.Equal(0, dashboard.PerfisAtualizadosUltimos7Dias);
    }

    [Fact]
    public async Task Most_used_competencies_count_only_active_students()
    {
        var activeId = await CreateStudentAsync("Active One", "active-one", active: true);
        var blockedId = await CreateStudentAsync("Blocked One", "blocked-one", active: false);

        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            db.Competencias.Add(new Competencia { Id = 100, Nome = "Blazor", NomeBusca = "blazor" });
            db.Competencias.Add(new Competencia { Id = 200, Nome = "Ember", NomeBusca = "ember" });
            await db.SaveChangesAsync();
        });

        await AddCompetencyToStudentAsync(activeId, 100);
        await AddCompetencyToStudentAsync(blockedId, 100);
        await AddCompetencyToStudentAsync(blockedId, 200);

        var dashboard = await GetDashboardAsync();
        var blazor = dashboard.CompetenciasMaisUtilizadas.Single(x => x.Id == 100);
        var ember = dashboard.CompetenciasMaisUtilizadas.SingleOrDefault(x => x.Id == 200);
        Assert.Equal(1, blazor.QuantidadeAlunos);
        Assert.Null(ember);
    }

    [Fact]
    public async Task Project_only_competency_does_not_affect_most_used_general_competencies()
    {
        var studentId = await CreateStudentAsync("Project Student", "project-student", active: true);

        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            db.Competencias.Add(new Competencia { Id = 300, Nome = "Podman", NomeBusca = "podman" });
            await db.SaveChangesAsync();
        });

        await AddProjectToStudentAsync(studentId, 300);

        var dashboard = await GetDashboardAsync();
        Assert.DoesNotContain(dashboard.CompetenciasMaisUtilizadas, x => x.Id == 300);
    }

    [Fact]
    public async Task Competencies_are_ordered_deterministically()
    {
        var a = await CreateStudentAsync("Student A", "std-a", active: true);
        var b = await CreateStudentAsync("Student B", "std-b", active: true);
        var c = await CreateStudentAsync("Student C", "std-c", active: true);

        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            db.Competencias.Add(new Competencia { Id = 1010, Nome = "Svelte", NomeBusca = "svelte" });
            db.Competencias.Add(new Competencia { Id = 1020, Nome = "Ember", NomeBusca = "ember" });
            db.Competencias.Add(new Competencia { Id = 1030, Nome = "Blazor", NomeBusca = "blazor" });
            db.Competencias.Add(new Competencia { Id = 1040, Nome = "Deno", NomeBusca = "deno" });
            db.Competencias.Add(new Competencia { Id = 1050, Nome = "Ruby", NomeBusca = "ruby" });
            db.Competencias.Add(new Competencia { Id = 1060, Nome = "Kotlin", NomeBusca = "kotlin" });
            await db.SaveChangesAsync();
        });

        await AddCompetencyToStudentAsync(a, 1030);
        await AddCompetencyToStudentAsync(b, 1030);
        await AddCompetencyToStudentAsync(c, 1030);
        await AddCompetencyToStudentAsync(a, 1020);
        await AddCompetencyToStudentAsync(b, 1020);
        await AddCompetencyToStudentAsync(a, 1010);
        await AddCompetencyToStudentAsync(c, 1010);
        await AddCompetencyToStudentAsync(a, 1040);
        await AddCompetencyToStudentAsync(b, 1050);
        await AddCompetencyToStudentAsync(c, 1060);

        var dashboard = await GetDashboardAsync();
        var ordered = dashboard.CompetenciasMaisUtilizadas.ToList();

        Assert.Equal(5, ordered.Count);
        Assert.Equal("Blazor", ordered[0].Nome);
        Assert.Equal(3, ordered[0].QuantidadeAlunos);
        Assert.Equal("Ember", ordered[1].Nome);
        Assert.Equal(2, ordered[1].QuantidadeAlunos);
        Assert.Equal("Svelte", ordered[2].Nome);
        Assert.Equal(2, ordered[2].QuantidadeAlunos);
        Assert.Equal("Deno", ordered[3].Nome);
        Assert.Equal("Kotlin", ordered[4].Nome);
    }

    public void Dispose() => factory.Dispose();
}
