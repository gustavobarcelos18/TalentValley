using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Tests;

// LGPD phase 5: students and recruiters must have accepted the CURRENT terms version to use the system.
// The block is enforced by the server on every protected endpoint, except the ones marked [AllowPendingTerms].
public sealed class TermsAcceptanceTests : IDisposable
{
    private const string Email = "pessoa@example.test";
    private const string AcceptUrl = "/api/auth/aceitar-termos";
    private const string PendingCode = "TERMOS_PENDENTES";
    private readonly ApiFactory factory = new();

    private async Task<HttpClient> LoggedInAsync(string email = Email)
    {
        var client = factory.Client();
        Assert.Equal(HttpStatusCode.OK, (await ApiFactory.LoginAsync(client, email)).StatusCode);
        // The anti-forgery token is tied to the signed-in user, so it is requested again after login.
        await ApiFactory.SetCsrfAsync(client);
        return client;
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        if (string.IsNullOrWhiteSpace(body)) return null;
        using var json = JsonDocument.Parse(body);
        return json.RootElement.TryGetProperty("code", out var code) ? code.GetString() : null;
    }

    private static async Task<UsuarioAutenticadoResponse> MeAsync(HttpClient client) =>
        (await client.GetFromJsonAsync<UsuarioAutenticadoResponse>("/api/auth/me", ApiFactory.JsonOptions))!;

    private async Task SetStoredTermsAsync(Guid userId, string role, string? version)
    {
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            if (role == AppRoles.Student)
                (await db.Alunos.SingleAsync(x => x.UserId == userId)).VersaoTermos = version;
            else
                (await db.Recrutadores.SingleAsync(x => x.UserId == userId)).VersaoTermos = version;
            await db.SaveChangesAsync();
        });
    }

    private async Task<(string? Version, DateTimeOffset? At)> ReadStoredTermsAsync(Guid userId, string role)
    {
        (string?, DateTimeOffset?) stored = default;
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            if (role == AppRoles.Student)
            {
                var aluno = await db.Alunos.AsNoTracking().SingleAsync(x => x.UserId == userId);
                stored = (aluno.VersaoTermos, aluno.ConsentimentoEm);
            }
            else
            {
                var recrutador = await db.Recrutadores.AsNoTracking().SingleAsync(x => x.UserId == userId);
                stored = (recrutador.VersaoTermos, recrutador.ConsentimentoEm);
            }
        });
        return stored;
    }

    [Theory]
    [InlineData(AppRoles.Student, null, "/api/alunos/me")]
    [InlineData(AppRoles.Student, "0.9", "/api/alunos/me")]
    [InlineData(AppRoles.Recruiter, null, "/api/recrutador/dashboard")]
    [InlineData(AppRoles.Recruiter, "0.9", "/api/talentos")]
    public async Task Pending_terms_block_protected_endpoints_with_a_stable_code(string role, string? version, string url)
    {
        await factory.CreateUserAsync(Email, role, termsVersion: version);
        using var client = await LoggedInAsync();

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(PendingCode, await CodeAsync(response));
    }

    [Theory]
    [InlineData("/api/probe/student", AppRoles.Student)]
    [InlineData("/api/probe/recruiter", AppRoles.Recruiter)]
    [InlineData("/api/probe/fallback", AppRoles.Student)]
    public async Task Pending_terms_block_policy_endpoints_and_the_fallback_policy(string url, string role)
    {
        await factory.CreateUserAsync(Email, role, termsVersion: null);
        using var client = await LoggedInAsync();

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(PendingCode, await CodeAsync(response));
    }

    [Fact]
    public async Task Pending_terms_block_state_changing_requests_before_the_action_runs()
    {
        await factory.CreateUserAsync(Email, termsVersion: null);
        using var client = await LoggedInAsync();

        var response = await client.PostAsJsonAsync("/api/alunos/me/experiencias", new { });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(PendingCode, await CodeAsync(response));
    }

    [Theory]
    [InlineData(AppRoles.Student)]
    [InlineData(AppRoles.Recruiter)]
    public async Task Pending_terms_block_the_endpoints_shared_by_students_and_recruiters(string role)
    {
        await factory.CreateUserAsync(Email, role, termsVersion: null);
        using var client = await LoggedInAsync();

        var response = await client.GetAsync("/api/competencias");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(PendingCode, await CodeAsync(response));
    }

    [Fact]
    public async Task Pending_terms_block_a_recruiter_mutation()
    {
        await factory.CreateUserAsync(Email, AppRoles.Recruiter, termsVersion: null);
        using var client = await LoggedInAsync();

        var response = await client.PostAsJsonAsync("/api/recrutador/favoritos/qualquer-slug", new { });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(PendingCode, await CodeAsync(response));
    }

    [Fact]
    public async Task Current_terms_keep_every_endpoint_available()
    {
        await factory.CreateUserAsync(Email);
        using var client = await LoggedInAsync();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/alunos/me")).StatusCode);
        Assert.False((await MeAsync(client)).TermosPendentes);
    }

    [Fact]
    public async Task A_role_mismatch_stays_a_plain_403_without_the_terms_code()
    {
        await factory.CreateUserAsync(Email, AppRoles.Recruiter, termsVersion: null);
        using var client = await LoggedInAsync();

        var response = await client.GetAsync("/api/alunos/me");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Null(await CodeAsync(response));
    }

    [Fact]
    public async Task Anonymous_requests_still_get_401_not_the_terms_code()
    {
        using var client = factory.Client();

        var response = await client.GetAsync("/api/alunos/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(await CodeAsync(response));
    }

    [Theory]
    [InlineData(AppRoles.Student)]
    [InlineData(AppRoles.Recruiter)]
    public async Task Login_and_me_report_pending_terms(string role)
    {
        await factory.CreateUserAsync(Email, role, termsVersion: null);
        using var client = factory.Client();

        var login = await ApiFactory.LoginAsync(client, Email);

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.True((await login.Content.ReadFromJsonAsync<LoginResponse>(ApiFactory.JsonOptions))!.Usuario.TermosPendentes);
        Assert.True((await MeAsync(client)).TermosPendentes);
    }

    [Theory]
    [InlineData(AppRoles.Student, "/api/alunos/me/exportacao", "/api/alunos/me/newsletter")]
    [InlineData(AppRoles.Recruiter, "/api/recrutador/me/exportacao", "/api/recrutador/me/newsletter")]
    public async Task Pending_terms_still_allow_export_and_newsletter_consent(string role, string exportUrl, string newsletterUrl)
    {
        await factory.CreateUserAsync(Email, role, termsVersion: null);
        using var client = await LoggedInAsync();

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(exportUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(newsletterUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await client.PutAsJsonAsync(newsletterUrl, new UpdateNewsletterRequest(false))).StatusCode);
    }

    [Theory]
    [InlineData(AppRoles.Student, "/api/alunos/me")]
    [InlineData(AppRoles.Recruiter, "/api/recrutador/me")]
    public async Task Pending_terms_still_allow_self_deletion(string role, string url)
    {
        await factory.CreateUserAsync(Email, role, termsVersion: null);
        using var client = await LoggedInAsync();

        var response = await client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, url)
        {
            Content = JsonContent.Create(new DeleteOwnProfileRequest(ApiFactory.Password))
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task Changing_the_password_stays_available_while_terms_are_pending()
    {
        await factory.CreateUserAsync(Email, termsVersion: null);
        using var client = await LoggedInAsync();

        var response = await client.PostAsJsonAsync("/api/auth/change-password",
            new ChangePasswordRequest(ApiFactory.Password, "NewPassword456"));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Theory]
    [InlineData(AppRoles.Student, "/api/alunos/me")]
    [InlineData(AppRoles.Recruiter, "/api/recrutador/dashboard")]
    public async Task Accepting_records_the_current_version_and_date_and_unblocks_the_account(string role, string url)
    {
        var id = await factory.CreateUserAsync(Email, role, termsVersion: null);
        using var client = await LoggedInAsync();
        var before = DateTimeOffset.UtcNow;

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync(AcceptUrl, null)).StatusCode);

        var (version, at) = await ReadStoredTermsAsync(id, role);
        Assert.Equal(SolicitacaoCadastroService.VersaoTermosAtual, version);
        Assert.True(at >= before && at <= DateTimeOffset.UtcNow);
        Assert.False((await MeAsync(client)).TermosPendentes);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(url)).StatusCode);
    }

    [Fact]
    public async Task Accepting_replaces_an_older_version_with_the_current_one()
    {
        var id = await factory.CreateUserAsync(Email, termsVersion: "0.9");
        using var client = await LoggedInAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync(AcceptUrl, null)).StatusCode);

        Assert.Equal(SolicitacaoCadastroService.VersaoTermosAtual, (await ReadStoredTermsAsync(id, AppRoles.Student)).Version);
    }

    [Fact]
    public async Task Accepting_again_keeps_the_original_acceptance_date()
    {
        var id = await factory.CreateUserAsync(Email, termsVersion: null);
        using var client = await LoggedInAsync();
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync(AcceptUrl, null)).StatusCode);
        var first = (await ReadStoredTermsAsync(id, AppRoles.Student)).At;

        await Task.Delay(20);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync(AcceptUrl, null)).StatusCode);

        Assert.Equal(first, (await ReadStoredTermsAsync(id, AppRoles.Student)).At);
    }

    [Fact]
    public async Task Accepting_only_changes_the_signed_in_person()
    {
        var mine = await factory.CreateUserAsync(Email, termsVersion: null);
        var other = await factory.CreateUserAsync("outra@example.test", termsVersion: null);
        using var client = await LoggedInAsync();

        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsync(AcceptUrl, null)).StatusCode);

        Assert.NotNull((await ReadStoredTermsAsync(mine, AppRoles.Student)).Version);
        Assert.Null((await ReadStoredTermsAsync(other, AppRoles.Student)).Version);
    }

    [Fact]
    public async Task A_terms_version_change_while_signed_in_blocks_the_next_request()
    {
        var id = await factory.CreateUserAsync(Email);
        using var client = await LoggedInAsync();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/alunos/me")).StatusCode);

        // Simulates a new terms version being published: the stored acceptance no longer matches.
        await SetStoredTermsAsync(id, AppRoles.Student, "0.9");

        var response = await client.GetAsync("/api/alunos/me");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal(PendingCode, await CodeAsync(response));
    }

    [Fact]
    public async Task Accepting_without_csrf_token_is_rejected_and_changes_nothing()
    {
        var id = await factory.CreateUserAsync(Email, termsVersion: null);
        using var client = await LoggedInAsync();
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");

        var response = await client.PostAsync(AcceptUrl, null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null((await ReadStoredTermsAsync(id, AppRoles.Student)).Version);
    }

    [Fact]
    public async Task Anonymous_accept_returns_401()
    {
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync(AcceptUrl, null)).StatusCode);
    }

    [Fact]
    public async Task Admin_never_has_pending_terms_and_cannot_record_an_acceptance()
    {
        await factory.CreateUserAsync(Email, AppRoles.Admin);
        using var client = await LoggedInAsync();

        Assert.False((await MeAsync(client)).TermosPendentes);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/admin/dashboard")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync(AcceptUrl, null)).StatusCode);
    }

    [Fact]
    public async Task Demonstration_accounts_are_exempt_from_the_terms()
    {
        // Demonstration accounts have no password: the administrator reaches them by switching into the session.
        factory.Overrides["Demo:Enabled"] = "true";
        await factory.CreateUserAsync(Email, AppRoles.Admin);
        using var client = await LoggedInAsync();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync("/api/admin/demo/preparar", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await client.PostAsJsonAsync("/api/admin/demo/entrar", new EnterDemoRequest(AppRoles.Student))).StatusCode);

        var me = await MeAsync(client);
        Assert.True(me.ModoDemonstracao);
        Assert.False(me.TermosPendentes);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/alunos/me")).StatusCode);
    }

    [Fact]
    public async Task A_blocked_account_with_pending_terms_still_gets_the_plain_403()
    {
        await factory.CreateUserAsync(Email, active: false, termsVersion: null);
        using var client = factory.Client();

        var login = await ApiFactory.LoginAsync(client, Email);

        Assert.Equal(HttpStatusCode.Forbidden, login.StatusCode);
        Assert.Null(await CodeAsync(login));
    }

    [Fact]
    public async Task An_open_session_of_an_account_blocked_after_login_gets_the_plain_403_even_with_terms_pending()
    {
        var id = await factory.CreateUserAsync(Email, termsVersion: null);
        using var client = await LoggedInAsync();
        await factory.InScopeAsync(async provider =>
        {
            var db = provider.GetRequiredService<AppDbContext>();
            (await db.Alunos.SingleAsync(x => x.UserId == id)).Ativo = false;
            await db.SaveChangesAsync();
        });

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Null(await CodeAsync(response));
    }

    public void Dispose() => factory.Dispose();
}
