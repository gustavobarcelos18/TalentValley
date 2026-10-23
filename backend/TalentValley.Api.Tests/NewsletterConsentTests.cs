using System.Net;
using System.Net.Http.Json;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Tests;

public sealed class NewsletterConsentTests : IDisposable
{
    private const string StudentEmail = "aluno@example.test";
    private const string OtherStudentEmail = "outro.aluno@example.test";
    private const string RecruiterEmail = "recrutador@example.test";
    private const string OtherRecruiterEmail = "outro.recrutador@example.test";
    private const string StudentUrl = "/api/alunos/me/newsletter";
    private const string RecruiterUrl = "/api/recrutador/me/newsletter";
    private readonly ApiFactory factory = new();

    private async Task<HttpClient> LoggedInAsync(string email)
    {
        var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, email)).StatusCode);
        // The anti-forgery token is tied to the signed-in user, so it is requested again after login.
        await ApiFactory.SetCsrfAsync(client);
        return client;
    }

    private static async Task<NewsletterResponse> ReadAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<NewsletterResponse>(ApiFactory.JsonOptions))!;

    [Theory]
    [InlineData(StudentUrl)]
    [InlineData(RecruiterUrl)]
    public async Task Anonymous_get_returns_401(string url)
    {
        using var client = factory.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(url)).StatusCode);
    }

    [Theory]
    [InlineData(AppRoles.Recruiter, StudentUrl)]
    [InlineData(AppRoles.Admin, StudentUrl)]
    [InlineData(AppRoles.Student, RecruiterUrl)]
    [InlineData(AppRoles.Admin, RecruiterUrl)]
    public async Task Other_roles_get_and_put_return_403(string role, string url)
    {
        await factory.CreateUserAsync("person@example.test", role);
        using var client = await LoggedInAsync("person@example.test");

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync(url, new UpdateNewsletterRequest(true))).StatusCode);
    }

    [Theory]
    [InlineData(StudentUrl, false)]
    [InlineData(RecruiterUrl, true)]
    public async Task Put_without_csrf_token_is_rejected(string url, bool recruiter)
    {
        await factory.CreateUserAsync(StudentEmail, recruiter ? AppRoles.Recruiter : AppRoles.Student);
        using var client = await LoggedInAsync(StudentEmail);
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");

        var response = await client.PutAsJsonAsync(url, new UpdateNewsletterRequest(true));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.False((await ReadStateAsync(StudentEmail)).Aceita);
    }

    [Fact]
    public async Task Recruiter_blocked_and_student_deactivated_after_login_cannot_change_newsletter()
    {
        var recruiterId = await factory.CreateUserAsync(RecruiterEmail, AppRoles.Recruiter);
        var studentId = await factory.CreateUserAsync(StudentEmail);
        using var recruiter = await LoggedInAsync(RecruiterEmail);
        using var student = await LoggedInAsync(StudentEmail);
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            (await db.Recrutadores.SingleAsync(x => x.UserId == recruiterId)).Status = StatusRecrutador.BLOQUEADO;
            (await db.Alunos.SingleAsync(x => x.UserId == studentId)).Ativo = false;
            await db.SaveChangesAsync();
        });

        Assert.Equal(HttpStatusCode.Forbidden, (await recruiter.GetAsync(RecruiterUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await student.GetAsync(StudentUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await recruiter.PutAsJsonAsync(RecruiterUrl, new UpdateNewsletterRequest(true))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await student.PutAsJsonAsync(StudentUrl, new UpdateNewsletterRequest(true))).StatusCode);
    }

    [Theory]
    [InlineData(StudentUrl, false)]
    [InlineData(RecruiterUrl, true)]
    public async Task Get_returns_off_without_date_for_accounts_that_never_opted_in(string url, bool recruiter)
    {
        await factory.CreateUserAsync(StudentEmail, recruiter ? AppRoles.Recruiter : AppRoles.Student);
        using var client = await LoggedInAsync(StudentEmail);

        var state = await ReadAsync(await client.GetAsync(url));

        Assert.False(state.Aceita);
        Assert.Null(state.AtualizadaEm);
    }

    [Theory]
    [InlineData(StudentUrl, false)]
    [InlineData(RecruiterUrl, true)]
    public async Task Opt_in_then_revoke_then_opt_in_again_records_each_real_change(string url, bool recruiter)
    {
        await factory.CreateUserAsync(StudentEmail, recruiter ? AppRoles.Recruiter : AppRoles.Student);
        using var client = await LoggedInAsync(StudentEmail);

        var optedIn = await ReadAsync(await client.PutAsJsonAsync(url, new UpdateNewsletterRequest(true)));
        Assert.True(optedIn.Aceita);
        Assert.NotNull(optedIn.AtualizadaEm);

        await Task.Delay(20);
        var revoked = await ReadAsync(await client.PutAsJsonAsync(url, new UpdateNewsletterRequest(false)));
        Assert.False(revoked.Aceita);
        Assert.True(revoked.AtualizadaEm > optedIn.AtualizadaEm);

        await Task.Delay(20);
        var again = await ReadAsync(await client.PutAsJsonAsync(url, new UpdateNewsletterRequest(true)));
        Assert.True(again.Aceita);
        Assert.True(again.AtualizadaEm > revoked.AtualizadaEm);

        // The stored state is what the GET returns afterwards.
        Assert.Equal(again, await ReadAsync(await client.GetAsync(url)));
    }

    [Theory]
    [InlineData(StudentUrl, false)]
    [InlineData(RecruiterUrl, true)]
    public async Task Saving_the_same_value_keeps_the_original_date(string url, bool recruiter)
    {
        await factory.CreateUserAsync(StudentEmail, recruiter ? AppRoles.Recruiter : AppRoles.Student);
        using var client = await LoggedInAsync(StudentEmail);

        var first = await ReadAsync(await client.PutAsJsonAsync(url, new UpdateNewsletterRequest(true)));
        await Task.Delay(20);
        var repeated = await ReadAsync(await client.PutAsJsonAsync(url, new UpdateNewsletterRequest(true)));

        Assert.Equal(first, repeated);

        var revoked = await ReadAsync(await client.PutAsJsonAsync(url, new UpdateNewsletterRequest(false)));
        await Task.Delay(20);
        var repeatedOff = await ReadAsync(await client.PutAsJsonAsync(url, new UpdateNewsletterRequest(false)));
        Assert.Equal(revoked, repeatedOff);
    }

    [Theory]
    [InlineData(StudentUrl, false)]
    [InlineData(RecruiterUrl, true)]
    public async Task Turning_off_for_an_account_that_never_opted_in_keeps_the_date_empty(string url, bool recruiter)
    {
        await factory.CreateUserAsync(StudentEmail, recruiter ? AppRoles.Recruiter : AppRoles.Student);
        using var client = await LoggedInAsync(StudentEmail);

        var state = await ReadAsync(await client.PutAsJsonAsync(url, new UpdateNewsletterRequest(false)));

        Assert.False(state.Aceita);
        Assert.Null(state.AtualizadaEm);
    }

    [Theory]
    [InlineData(StudentUrl, "{}")]
    [InlineData(StudentUrl, "{\"aceita\":null}")]
    [InlineData(RecruiterUrl, "{}")]
    [InlineData(RecruiterUrl, "{\"aceita\":null}")]
    public async Task Missing_or_null_value_returns_400_and_changes_nothing(string url, string json)
    {
        await factory.CreateUserAsync(StudentEmail, url == RecruiterUrl ? AppRoles.Recruiter : AppRoles.Student);
        using var client = await LoggedInAsync(StudentEmail);
        await client.PutAsJsonAsync(url, new UpdateNewsletterRequest(true));

        var response = await client.PutAsync(url, new StringContent(json, Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await ReadAsync(await client.GetAsync(url))).Aceita);
    }

    [Fact]
    public async Task Student_ignores_a_user_id_and_only_changes_own_consent()
    {
        await factory.CreateUserAsync(StudentEmail);
        var otherId = await factory.CreateUserAsync(OtherStudentEmail);
        using var client = await LoggedInAsync(StudentEmail);

        var response = await client.PutAsJsonAsync($"{StudentUrl}?userId={otherId}&alunoId={otherId}",
            new { aceita = true, userId = otherId });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True((await ReadStateAsync(StudentEmail)).Aceita);
        Assert.False((await ReadStateAsync(OtherStudentEmail)).Aceita);
        Assert.Null((await ReadStateAsync(OtherStudentEmail)).AtualizadaEm);
    }

    [Fact]
    public async Task Recruiter_ignores_a_user_id_and_only_changes_own_consent()
    {
        await factory.CreateUserAsync(RecruiterEmail, AppRoles.Recruiter);
        var otherId = await factory.CreateUserAsync(OtherRecruiterEmail, AppRoles.Recruiter);
        using var client = await LoggedInAsync(RecruiterEmail);

        var response = await client.PutAsJsonAsync($"{RecruiterUrl}?userId={otherId}&recrutadorId={otherId}",
            new { aceita = true, userId = otherId });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True((await ReadStateAsync(RecruiterEmail)).Aceita);
        Assert.False((await ReadStateAsync(OtherRecruiterEmail)).Aceita);
        Assert.Null((await ReadStateAsync(OtherRecruiterEmail)).AtualizadaEm);
    }

    [Fact]
    public async Task Changed_consent_shows_up_in_the_student_data_export()
    {
        await factory.CreateUserAsync(StudentEmail);
        using var client = await LoggedInAsync(StudentEmail);
        var saved = await ReadAsync(await client.PutAsJsonAsync(StudentUrl, new UpdateNewsletterRequest(true)));

        var export = (await client.GetFromJsonAsync<ExportacaoAlunoResponse>(
            "/api/alunos/me/exportacao", ApiFactory.JsonOptions))!;

        Assert.True(export.Consentimentos.NewsletterAceita);
        Assert.Equal(saved.AtualizadaEm, export.Consentimentos.NewsletterAtualizadaEm);
    }

    [Fact]
    public async Task Changed_consent_shows_up_in_the_recruiter_data_export()
    {
        await factory.CreateUserAsync(RecruiterEmail, AppRoles.Recruiter);
        using var client = await LoggedInAsync(RecruiterEmail);
        var saved = await ReadAsync(await client.PutAsJsonAsync(RecruiterUrl, new UpdateNewsletterRequest(true)));

        var export = (await client.GetFromJsonAsync<ExportacaoRecrutadorResponse>(
            "/api/recrutador/me/exportacao", ApiFactory.JsonOptions))!;

        Assert.True(export.Consentimentos.NewsletterAceita);
        Assert.Equal(saved.AtualizadaEm, export.Consentimentos.NewsletterAtualizadaEm);
    }

    // Reads the stored state straight from the database, for accounts the test is not logged in as.
    private async Task<NewsletterResponse> ReadStateAsync(string email)
    {
        NewsletterResponse? state = null;
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            var userId = (await db.Users.SingleAsync(x => x.Email == email)).Id;
            state = await db.Alunos.Where(x => x.UserId == userId)
                .Select(x => new NewsletterResponse(x.NewsletterAceita, x.NewsletterAtualizadaEm)).SingleOrDefaultAsync()
                ?? await db.Recrutadores.Where(x => x.UserId == userId)
                    .Select(x => new NewsletterResponse(x.NewsletterAceita, x.NewsletterAtualizadaEm)).SingleAsync();
        });
        return state!;
    }

    public void Dispose() => factory.Dispose();
}
