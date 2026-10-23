using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class DemoTests : IDisposable
{
    private const string Prepare = "/api/admin/demo/preparar";
    private const string Restore = "/api/admin/demo/restaurar";
    private const string State = "/api/admin/demo/estado";
    private const int DemoStudents = 6;

    private readonly ApiFactory factory = new();

    public void Dispose() => factory.Dispose();

    private static string Email(string prefix) => $"{prefix}-{Guid.NewGuid():N}@example.test";

    // Must run before the first request: the host reads configuration when it starts.
    private void TurnOn() => factory.Overrides["Demo:Enabled"] = "true";

    private async Task<HttpClient> SignedInAsync(string role)
    {
        var email = Email(role.ToLowerInvariant());
        await factory.CreateUserAsync(email, role);
        var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        return client;
    }

    private static async Task<DemoChangeResponse> ChangeAsync(HttpClient client, string url)
    {
        var response = await client.PostAsync(url, null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<DemoChangeResponse>(ApiFactory.JsonOptions))!;
    }

    private Task<List<ApplicationUser>> DemoUsersAsync() => QueryAsync(db => db.Users.AsNoTracking()
        .Where(x => x.EhDemo).OrderBy(x => x.Email).ToListAsync());

    private async Task<T> QueryAsync<T>(Func<AppDbContext, Task<T>> query)
    {
        T result = default!;
        await factory.InScopeAsync(async services => result = await query(services.GetRequiredService<AppDbContext>()));
        return result;
    }

    [Fact]
    public async Task State_AnswersEvenWhenOff_AndEndpointsActLikeTheyDoNotExist()
    {
        var admin = await SignedInAsync(AppRoles.Admin);

        var state = await admin.GetFromJsonAsync<DemoStateResponse>(State, ApiFactory.JsonOptions);
        Assert.False(state!.Habilitado);
        Assert.False(state.Preparado);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync(Prepare, null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync(Restore, null)).StatusCode);
        Assert.Empty(await DemoUsersAsync());
    }

    [Theory]
    [InlineData(State, false)]
    [InlineData(Prepare, true)]
    [InlineData(Restore, true)]
    public async Task OnlyAdministratorsCanUseTheDemoEndpoints(string url, bool post)
    {
        TurnOn();
        var anonymous = factory.Client();
        await ApiFactory.SetCsrfAsync(anonymous);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(anonymous, url, post)).StatusCode);

        foreach (var role in new[] { AppRoles.Student, AppRoles.Recruiter })
        {
            var client = await SignedInAsync(role);
            Assert.Equal(HttpStatusCode.Forbidden, (await Send(client, url, post)).StatusCode);
        }
        Assert.Empty(await DemoUsersAsync());
    }

    private static Task<HttpResponseMessage> Send(HttpClient client, string url, bool post) =>
        post ? client.PostAsync(url, null) : client.GetAsync(url);

    [Fact]
    public async Task Prepare_CreatesOnlyFictitiousAccountsWithoutPasswordsOrFiles()
    {
        TurnOn();
        var admin = await SignedInAsync(AppRoles.Admin);

        var result = await ChangeAsync(admin, Prepare);

        Assert.Equal(new DemoChangeResponse(DemoStudents, 1), result);
        var users = await DemoUsersAsync();
        Assert.Equal(DemoStudents + 1, users.Count);
        Assert.All(users, user =>
        {
            Assert.EndsWith("@demo.invalid", user.Email);
            Assert.True(user.EmailConfirmed);
            Assert.Null(user.PasswordHash);
        });
        await factory.InScopeAsync(async services =>
        {
            var manager = services.GetRequiredService<UserManager<ApplicationUser>>();
            foreach (var user in users) Assert.False(await manager.HasPasswordAsync(user));
            Assert.Equal(DemoStudents, (await manager.GetUsersInRoleAsync(AppRoles.Student)).Count(x => x.EhDemo));
            Assert.Equal(1, (await manager.GetUsersInRoleAsync(AppRoles.Recruiter)).Count(x => x.EhDemo));
        });

        var state = await admin.GetFromJsonAsync<DemoStateResponse>(State, ApiFactory.JsonOptions);
        Assert.True(state!.Habilitado);
        Assert.True(state.Preparado);

        var audit = await QueryAsync(db => db.Auditorias.AsNoTracking().SingleAsync(x => x.Acao == AcaoAuditoria.DEMO_PREPARADA));
        Assert.Equal("DEMO", audit.EntidadeTipo);
        Assert.NotNull(audit.AdminUserId);
    }

    [Fact]
    public async Task Prepare_BuildsProfilesThatFollowTheApprovedRules()
    {
        TurnOn();
        var admin = await SignedInAsync(AppRoles.Admin);
        await ChangeAsync(admin, Prepare);

        var students = await QueryAsync(db => db.Alunos.AsNoTracking().AsSplitQuery()
            .Include(x => x.Formacoes).Include(x => x.Experiencias).Include(x => x.Projetos).ThenInclude(x => x.Competencias)
            .Include(x => x.Competencias).Include(x => x.Idiomas).Include(x => x.Disponibilidades).Include(x => x.Modalidades)
            .Include(x => x.AreasInteresse).Include(x => x.CategoriasCnh).Include(x => x.TiposDeficiencia)
            .Where(x => x.User.EhDemo).ToListAsync());

        Assert.Equal(DemoStudents, students.Count);
        Assert.Equal(DemoStudents, students.Select(x => x.Slug).Distinct().Count());
        foreach (var student in students)
        {
            Assert.True(student.Ativo);
            Assert.Null(student.FotoStorageKey);
            Assert.Null(student.CurriculoStorageKey);
            Assert.False(string.IsNullOrWhiteSpace(student.Cidade));
            Assert.True(InputValidation.IsValidPhoneInput(student.Telefone!));
            Assert.NotEmpty(student.Competencias);
            Assert.NotEmpty(student.Idiomas);
            Assert.NotEmpty(student.Disponibilidades);
            Assert.NotEmpty(student.Modalidades);
            Assert.NotNull(student.StatusBusca);
            Assert.NotNull(student.StatusBuscaConfirmadoEm);
            Assert.True(student.ObjetivoProfissional is { Length: > 0 and <= 280 });
            Assert.InRange(student.AreasInteresse.Count, 1, 5);
            Assert.NotNull(student.CargaHorariaSemanal);
            Assert.True(student.DisponivelImediatamente ^ student.DisponivelAPartirDe is not null);
            // The demo never invents sensitive data.
            Assert.False(student.SouPcd);
            Assert.False(student.InteresseVagaPcd);
            Assert.Null(student.ConsentimentoPcdEm);
            Assert.Empty(student.TiposDeficiencia);
            Assert.True(student.Bio is { Length: > 0 and <= 1500 });
            Assert.Equal(1, student.Formacoes.Count(x => x.Principal));
            Assert.InRange(student.Projetos.Count, 1, 2);
            Assert.Equal(Enumerable.Range(1, student.Projetos.Count), student.Projetos.Select(x => x.Ordem).Order());
            Assert.All(student.Projetos, project => Assert.True(project.Descricao.Length <= 1000));
            Assert.All(student.Formacoes, formation =>
            {
                Assert.Null(formation.CertificadoStorageKey);
                if (formation.Status == StatusFormacao.CONCLUIDO) Assert.NotNull(formation.DataFim);
                if (formation.DataFim is not null) Assert.True(formation.DataFim >= formation.DataInicio);
                // A verified validation needs a certificate, and the demo has none: it must never be verified.
                if (formation.EhRioPombaValley) Assert.Equal(StatusValidacaoRpv.PENDENTE, formation.StatusValidacaoRpv);
                else Assert.Null(formation.StatusValidacaoRpv);
            });
            Assert.All(student.Experiencias, experience =>
                Assert.Equal(experience.DataFim is null, experience.Atual));
        }
        Assert.Contains(students, x => x.Formacoes.Any(f => f.EhRioPombaValley));

        var recruiter = await QueryAsync(db => db.Recrutadores.AsNoTracking().SingleAsync(x => x.User.EhDemo));
        Assert.Equal(StatusRecrutador.ATIVO, recruiter.Status);
        Assert.True(InputValidation.IsValidPhoneInput(recruiter.Telefone));
    }

    [Fact]
    public async Task Prepare_RunTwice_CreatesNothingTheSecondTime()
    {
        TurnOn();
        var admin = await SignedInAsync(AppRoles.Admin);
        await ChangeAsync(admin, Prepare);
        var firstIds = (await DemoUsersAsync()).Select(x => x.Id).Order().ToList();

        var second = await ChangeAsync(admin, Prepare);

        Assert.Equal(new DemoChangeResponse(0, 0), second);
        Assert.Equal(firstIds, (await DemoUsersAsync()).Select(x => x.Id).Order().ToList());
    }

    [Fact]
    public async Task Prepare_CreatesWhatIsMissingAndKeepsWhatExists()
    {
        TurnOn();
        var admin = await SignedInAsync(AppRoles.Admin);
        await ChangeAsync(admin, Prepare);
        var removed = (await DemoUsersAsync()).First(x => x.Email!.StartsWith("marina", StringComparison.Ordinal));
        var kept = (await DemoUsersAsync()).Where(x => x.Id != removed.Id).Select(x => x.Id).Order().ToList();
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            db.Alunos.Remove(await db.Alunos.SingleAsync(x => x.UserId == removed.Id));
            await db.SaveChangesAsync();
            Assert.True((await services.GetRequiredService<UserManager<ApplicationUser>>().DeleteAsync(removed)).Succeeded);
        });

        var result = await ChangeAsync(admin, Prepare);

        Assert.Equal(new DemoChangeResponse(1, 0), result);
        var after = (await DemoUsersAsync()).Select(x => x.Id).ToHashSet();
        Assert.True(kept.All(after.Contains));
        Assert.Equal(DemoStudents + 1, after.Count);
    }

    [Fact]
    public async Task DemoAccountsCannotSignInWithAnyPassword()
    {
        TurnOn();
        var admin = await SignedInAsync(AppRoles.Admin);
        await ChangeAsync(admin, Prepare);

        foreach (var user in await DemoUsersAsync())
        {
            var client = factory.Client();
            var response = await ApiFactory.LoginAsync(client, user.Email!, ApiFactory.Password);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }

    [Fact]
    public async Task PrepareAndRestore_NeverTouchRealAccounts()
    {
        TurnOn();
        var realStudentEmail = Email("real-student");
        var realStudentId = await factory.CreateUserAsync(realStudentEmail, AppRoles.Student);
        var realRecruiterId = await factory.CreateUserAsync(Email("real-recruiter"), AppRoles.Recruiter);
        var admin = await SignedInAsync(AppRoles.Admin);

        await ChangeAsync(admin, Prepare);
        await ChangeAsync(admin, Restore);

        var real = await QueryAsync(db => db.Users.AsNoTracking().Where(x => !x.EhDemo).ToListAsync());
        Assert.Contains(real, x => x.Id == realStudentId && x.Email == realStudentEmail && x.PasswordHash is not null);
        Assert.Contains(real, x => x.Id == realRecruiterId);
        Assert.Equal(3, real.Count);
        Assert.Equal(1, await QueryAsync(db => db.Alunos.CountAsync(x => !x.User.EhDemo)));
        Assert.Equal(1, await QueryAsync(db => db.Recrutadores.CountAsync(x => !x.User.EhDemo)));
    }

    [Fact]
    public async Task Prepare_RefusesWhenADemoEmailBelongsToARealAccount()
    {
        TurnOn();
        var realId = await factory.CreateUserAsync("marina.couto@demo.invalid", AppRoles.Student);
        var admin = await SignedInAsync(AppRoles.Admin);

        var response = await admin.PostAsync(Prepare, null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Empty(await DemoUsersAsync());
        Assert.True(await QueryAsync(db => db.Users.AnyAsync(x => x.Id == realId && !x.EhDemo)));
        Assert.False(await QueryAsync(db => db.Auditorias.AnyAsync(x => x.Acao == AcaoAuditoria.DEMO_PREPARADA)));
    }

    [Fact]
    public async Task Prepare_RefusesWhenARealAccountUsesADemoEmailInAnotherCase()
    {
        TurnOn();
        await factory.CreateUserAsync("MARINA.Couto@Demo.Invalid", AppRoles.Student);
        var admin = await SignedInAsync(AppRoles.Admin);

        var response = await admin.PostAsync(Prepare, null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Empty(await DemoUsersAsync());
    }

    [Fact]
    public async Task Restore_WhenARealAccountOwnsADemoEmail_RollsBackAndKeepsTheCurrentDemo()
    {
        TurnOn();
        var admin = await SignedInAsync(AppRoles.Admin);
        await ChangeAsync(admin, Prepare);
        var before = await DemoUsersAsync();
        // Simulates a real person who took one of the demo addresses after the demo was prepared.
        var taken = before.First(x => x.Email!.StartsWith("rafael", StringComparison.Ordinal));
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            await db.Users.Where(x => x.Id == taken.Id).ExecuteUpdateAsync(x => x.SetProperty(u => u.EhDemo, false));
        });

        var response = await admin.PostAsync(Restore, null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var after = await DemoUsersAsync();
        Assert.Equal(before.Where(x => x.Id != taken.Id).Select(x => x.Id).Order(), after.Select(x => x.Id).Order());
        Assert.True(await QueryAsync(db => db.Alunos.AnyAsync(x => x.UserId == taken.Id)));
        Assert.False(await QueryAsync(db => db.Auditorias.AnyAsync(x => x.Acao == AcaoAuditoria.DEMO_RESTAURADA)));
    }

    [Fact]
    public async Task Restore_RemovesChangesAndFavoritesAndRecreatesTheOriginalSet()
    {
        TurnOn();
        var admin = await SignedInAsync(AppRoles.Admin);
        await ChangeAsync(admin, Prepare);
        var oldIds = (await DemoUsersAsync()).Select(x => x.Id).ToHashSet();
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var student = await db.Alunos.Include(x => x.User).FirstAsync(x => x.User.EhDemo);
            student.Bio = "Texto alterado durante a apresentação.";
            var recruiter = await db.Recrutadores.SingleAsync(x => x.User.EhDemo);
            db.Favoritos.Add(new Favorito { RecrutadorId = recruiter.UserId, AlunoId = student.UserId, CriadoEm = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        });

        var result = await ChangeAsync(admin, Restore);

        Assert.Equal(new DemoChangeResponse(DemoStudents, 1), result);
        var newUsers = await DemoUsersAsync();
        Assert.Equal(DemoStudents + 1, newUsers.Count);
        Assert.DoesNotContain(newUsers, x => oldIds.Contains(x.Id));
        Assert.Equal(0, await QueryAsync(db => db.Favoritos.CountAsync()));
        Assert.Equal(0, await QueryAsync(db => db.Alunos.CountAsync(x => x.Bio == "Texto alterado durante a apresentação.")));
        Assert.True(await QueryAsync(db => db.Auditorias.AnyAsync(x => x.Acao == AcaoAuditoria.DEMO_RESTAURADA)));
    }

    [Fact]
    public async Task Restore_OnAnEmptyDemo_JustCreatesIt()
    {
        TurnOn();
        var admin = await SignedInAsync(AppRoles.Admin);

        var result = await ChangeAsync(admin, Restore);

        Assert.Equal(new DemoChangeResponse(DemoStudents, 1), result);
        Assert.Equal(DemoStudents + 1, (await DemoUsersAsync()).Count);
    }
}
