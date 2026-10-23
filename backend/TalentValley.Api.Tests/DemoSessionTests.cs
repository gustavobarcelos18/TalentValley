using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Tests;

// The administrator's switch into a demonstration account and back: who may do it, what the demo session can
// and cannot do, and that a forged or stale demo session is never accepted.
public sealed class DemoSessionTests : IDisposable
{
    private const string Prepare = "/api/admin/demo/preparar";
    private const string Enter = "/api/admin/demo/entrar";
    private const string Back = "/api/demo/voltar";
    private const string State = "/api/admin/demo/estado";
    private const string Me = "/api/auth/me";

    private readonly ApiFactory factory = new();

    public void Dispose() => factory.Dispose();

    private static string Email(string prefix) => $"{prefix}-{Guid.NewGuid():N}@example.test";

    // Must run before the first request: the host reads configuration when it starts.
    private void TurnOn() => factory.Overrides["Demo:Enabled"] = "true";

    // Expires is when the administrator's own session ends; a demo session must never outlive it.
    private sealed record Admin(HttpClient Client, Guid Id, DateTime Expires);

    private async Task<Admin> AdminAsync(bool prepared = true)
    {
        TurnOn();
        var email = Email("admin");
        var id = await factory.CreateUserAsync(email, AppRoles.Admin);
        var client = factory.Client();
        var login = await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        if (prepared) Assert.Equal(HttpStatusCode.OK, (await client.PostAsync(Prepare, null)).StatusCode);
        return new(client, id, TokenExpiry(login));
    }

    private static DateTime TokenExpiry(HttpResponseMessage response)
    {
        var cookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), x => x.StartsWith("tv_access="));
        return new JwtSecurityTokenHandler().ReadJwtToken(cookie.Split(';')[0]["tv_access=".Length..]).ValidTo;
    }

    private static Task<HttpResponseMessage> Delete(HttpClient client, string url) =>
        client.SendAsync(new HttpRequestMessage(HttpMethod.Delete, url)
        { Content = JsonContent.Create(new DeleteOwnProfileRequest("anything")) });

    private async Task<HttpClient> SignedInAsync(string role)
    {
        var email = Email(role.ToLowerInvariant());
        await factory.CreateUserAsync(email, role);
        var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);
        return client;
    }

    private static Task<HttpResponseMessage> EnterAs(HttpClient client, string role) =>
        client.PostAsJsonAsync(Enter, new EnterDemoRequest(role));

    private static async Task<UsuarioAutenticadoResponse> CurrentUserAsync(HttpClient client)
    {
        var response = await client.GetAsync(Me);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<UsuarioAutenticadoResponse>(ApiFactory.JsonOptions))!;
    }

    private async Task<T> WithServicesAsync<T>(Func<IServiceProvider, Task<T>> action)
    {
        T result = default!;
        await factory.InScopeAsync(async services => result = await action(services));
        return result;
    }

    private Task<ApplicationUser> DemoUserAsync(string role) => WithServicesAsync(async services =>
    {
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        var roleUsers = await users.GetUsersInRoleAsync(role);
        return roleUsers.First(x => x.EhDemo);
    });

    [Fact]
    public async Task Admin_steps_into_demo_student_and_back()
    {
        var admin = await AdminAsync();

        var entered = await EnterAs(admin.Client, AppRoles.Student);
        Assert.Equal(HttpStatusCode.OK, entered.StatusCode);
        var body = (await entered.Content.ReadFromJsonAsync<LoginResponse>(ApiFactory.JsonOptions))!;
        Assert.Equal("/meu-perfil", body.DestinoInicial);
        Assert.Equal(AppRoles.Student, body.Usuario.Role);
        Assert.True(body.Usuario.ModoDemonstracao);
        var cookie = Assert.Single(entered.Headers.GetValues("Set-Cookie"), x => x.StartsWith("tv_access="));
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);

        var me = await CurrentUserAsync(admin.Client);
        Assert.Equal(AppRoles.Student, me.Role);
        Assert.True(me.ModoDemonstracao);
        Assert.EndsWith("@demo.invalid", me.Email);
        // The student area works as that demo student...
        Assert.Equal(HttpStatusCode.OK, (await admin.Client.GetAsync("/api/alunos/me")).StatusCode);
        // ...and the administrator area is closed while in the demo session.
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.Client.GetAsync(State)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.Client.GetAsync("/api/admin/auditoria")).StatusCode);

        await ApiFactory.SetCsrfAsync(admin.Client);
        var returned = await admin.Client.PostAsync(Back, null);
        Assert.Equal(HttpStatusCode.OK, returned.StatusCode);
        var back = (await returned.Content.ReadFromJsonAsync<LoginResponse>(ApiFactory.JsonOptions))!;
        Assert.Equal("/admin", back.DestinoInicial);
        Assert.Equal(admin.Id, back.Usuario.Id);
        Assert.False(back.Usuario.ModoDemonstracao);

        var meAgain = await CurrentUserAsync(admin.Client);
        Assert.Equal(AppRoles.Admin, meAgain.Role);
        Assert.False(meAgain.ModoDemonstracao);
        Assert.Equal(HttpStatusCode.OK, (await admin.Client.GetAsync(State)).StatusCode);
    }

    [Fact]
    public async Task Admin_steps_into_demo_recruiter_and_sees_only_demo_students()
    {
        var admin = await AdminAsync();

        var entered = await EnterAs(admin.Client, AppRoles.Recruiter);
        Assert.Equal(HttpStatusCode.OK, entered.StatusCode);
        var body = (await entered.Content.ReadFromJsonAsync<LoginResponse>(ApiFactory.JsonOptions))!;
        Assert.Equal("/recrutador", body.DestinoInicial);
        Assert.Equal(AppRoles.Recruiter, body.Usuario.Role);
        Assert.True(body.Usuario.ModoDemonstracao);
        Assert.Equal(HttpStatusCode.OK, (await admin.Client.GetAsync("/api/talentos")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.Client.GetAsync(State)).StatusCode);
    }

    [Fact]
    public async Task Switch_and_return_are_audited_and_listed_for_the_admin()
    {
        var admin = await AdminAsync();
        Assert.Equal(HttpStatusCode.OK, (await EnterAs(admin.Client, AppRoles.Student)).StatusCode);
        await ApiFactory.SetCsrfAsync(admin.Client);
        Assert.Equal(HttpStatusCode.OK, (await admin.Client.PostAsync(Back, null)).StatusCode);

        var entries = await WithServicesAsync(services => services.GetRequiredService<AppDbContext>().Auditorias
            .AsNoTracking().Where(x => x.Acao == AcaoAuditoria.DEMO_ENTROU || x.Acao == AcaoAuditoria.DEMO_VOLTOU)
            .ToListAsync());
        Assert.Equal(2, entries.Count);
        Assert.All(entries, x => Assert.Equal(admin.Id, x.AdminUserId));
        Assert.All(entries, x => Assert.DoesNotContain("Marina", x.Descricao));

        var listed = await admin.Client.GetFromJsonAsync<PaginatedResponse<AuditoriaListItem>>(
            "/api/admin/auditoria", ApiFactory.JsonOptions);
        Assert.Contains(listed!.Items, x => x.Acao == AcaoAuditoria.DEMO_ENTROU);
        Assert.Contains(listed.Items, x => x.Acao == AcaoAuditoria.DEMO_VOLTOU);
    }

    [Fact]
    public async Task Switching_never_renews_the_session()
    {
        var admin = await AdminAsync();

        var entered = await EnterAs(admin.Client, AppRoles.Student);
        Assert.Equal(admin.Expires, TokenExpiry(entered));
        await ApiFactory.SetCsrfAsync(admin.Client);
        Assert.Equal(admin.Expires, TokenExpiry(await admin.Client.PostAsync(Back, null)));
    }

    // Only flagged demo accounts can be switched into, even when the e-mail is the expected one.
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task A_demo_email_that_is_not_an_active_demo_account_is_refused(bool realAccount)
    {
        var admin = await AdminAsync();
        await factory.InScopeAsync(async services =>
        {
            var db = services.GetRequiredService<AppDbContext>();
            var demo = await db.Users.SingleAsync(x => x.EhDemo && x.Email!.StartsWith("marina.couto"));
            if (realAccount) demo.EhDemo = false;
            else (await db.Alunos.SingleAsync(x => x.UserId == demo.Id)).Ativo = false;
            await db.SaveChangesAsync();
        });

        var response = await EnterAs(admin.Client, AppRoles.Student);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.False(response.Headers.Contains("Set-Cookie"));
        Assert.Equal(AppRoles.Admin, (await CurrentUserAsync(admin.Client)).Role);
    }

    [Fact]
    public async Task Entering_with_demo_mode_off_acts_like_the_endpoint_does_not_exist()
    {
        var email = Email("admin");
        await factory.CreateUserAsync(email, AppRoles.Admin);
        using var client = factory.Client();
        await ApiFactory.LoginAsync(client, email);
        await ApiFactory.SetCsrfAsync(client);

        Assert.Equal(HttpStatusCode.NotFound, (await EnterAs(client, AppRoles.Student)).StatusCode);
        Assert.Equal(AppRoles.Admin, (await CurrentUserAsync(client)).Role);
    }

    [Fact]
    public async Task Entering_before_the_demo_is_prepared_is_refused_and_keeps_the_admin_session()
    {
        var admin = await AdminAsync(prepared: false);

        Assert.Equal(HttpStatusCode.Conflict, (await EnterAs(admin.Client, AppRoles.Student)).StatusCode);
        Assert.Equal(AppRoles.Admin, (await CurrentUserAsync(admin.Client)).Role);
    }

    [Theory]
    [InlineData("ADMIN")]
    [InlineData("")]
    [InlineData("aluno")]
    public async Task Only_student_or_recruiter_can_be_requested(string role)
    {
        var admin = await AdminAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await EnterAs(admin.Client, role)).StatusCode);
        Assert.Equal(AppRoles.Admin, (await CurrentUserAsync(admin.Client)).Role);
    }

    [Fact]
    public async Task Request_cannot_choose_the_account_only_the_role()
    {
        var admin = await AdminAsync();
        var realStudent = await factory.CreateUserAsync(Email("real"));

        var response = await admin.Client.PostAsJsonAsync(Enter, new { papel = AppRoles.Student, userId = realStudent });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var me = await CurrentUserAsync(admin.Client);
        Assert.NotEqual(realStudent, me.Id);
        Assert.EndsWith("@demo.invalid", me.Email);
    }

    [Fact]
    public async Task Entering_requires_antiforgery()
    {
        var admin = await AdminAsync();
        admin.Client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");

        Assert.Equal(HttpStatusCode.BadRequest, (await EnterAs(admin.Client, AppRoles.Student)).StatusCode);
        Assert.Equal(AppRoles.Admin, (await CurrentUserAsync(admin.Client)).Role);
    }

    [Fact]
    public async Task Returning_requires_antiforgery()
    {
        var admin = await AdminAsync();
        Assert.Equal(HttpStatusCode.OK, (await EnterAs(admin.Client, AppRoles.Student)).StatusCode);
        admin.Client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.Client.PostAsync(Back, null)).StatusCode);
        Assert.True((await CurrentUserAsync(admin.Client)).ModoDemonstracao);
    }

    [Fact]
    public async Task Real_students_and_recruiters_and_anonymous_cannot_enter()
    {
        await AdminAsync();
        using var anonymous = factory.Client();
        await ApiFactory.SetCsrfAsync(anonymous);
        Assert.Equal(HttpStatusCode.Unauthorized, (await EnterAs(anonymous, AppRoles.Student)).StatusCode);

        foreach (var role in new[] { AppRoles.Student, AppRoles.Recruiter })
        {
            using var client = await SignedInAsync(role);
            Assert.Equal(HttpStatusCode.Forbidden, (await EnterAs(client, AppRoles.Student)).StatusCode);
            Assert.False((await CurrentUserAsync(client)).ModoDemonstracao);
        }
    }

    [Fact]
    public async Task Return_is_refused_outside_a_demo_session()
    {
        var admin = await AdminAsync();
        using var anonymous = factory.Client();
        await ApiFactory.SetCsrfAsync(anonymous);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PostAsync(Back, null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await admin.Client.PostAsync(Back, null)).StatusCode);

        foreach (var role in new[] { AppRoles.Student, AppRoles.Recruiter })
        {
            using var client = await SignedInAsync(role);
            Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync(Back, null)).StatusCode);
            Assert.Equal(role, (await CurrentUserAsync(client)).Role);
        }
    }

    [Fact]
    public async Task A_demo_session_cannot_switch_again()
    {
        var admin = await AdminAsync();
        Assert.Equal(HttpStatusCode.OK, (await EnterAs(admin.Client, AppRoles.Student)).StatusCode);
        await ApiFactory.SetCsrfAsync(admin.Client);

        Assert.Equal(HttpStatusCode.Forbidden, (await EnterAs(admin.Client, AppRoles.Recruiter)).StatusCode);
        Assert.Equal(AppRoles.Student, (await CurrentUserAsync(admin.Client)).Role);
    }

    [Fact]
    public async Task Demo_accounts_cannot_sign_in_with_a_password()
    {
        var admin = await AdminAsync();
        var demo = await DemoUserAsync(AppRoles.Student);
        // Even if a password somehow existed, the login form must refuse the account.
        await factory.InScopeAsync(async services =>
        {
            var users = services.GetRequiredService<UserManager<ApplicationUser>>();
            Assert.True((await users.AddPasswordAsync((await users.FindByIdAsync(demo.Id.ToString()))!, ApiFactory.Password)).Succeeded);
        });

        using var client = factory.Client();
        var login = await ApiFactory.LoginAsync(client, demo.Email!);

        Assert.Equal(HttpStatusCode.Unauthorized, login.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(Me)).StatusCode);
        Assert.Equal(AppRoles.Admin, (await CurrentUserAsync(admin.Client)).Role);
    }

    [Fact]
    public async Task Demo_sessions_cannot_change_the_password_or_delete_the_account()
    {
        var admin = await AdminAsync();
        Assert.Equal(HttpStatusCode.OK, (await EnterAs(admin.Client, AppRoles.Student)).StatusCode);
        await ApiFactory.SetCsrfAsync(admin.Client);

        Assert.Equal(HttpStatusCode.Forbidden, (await admin.Client.PostAsJsonAsync("/api/auth/change-password",
            new ChangePasswordRequest("anything", "NewPassword123"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Delete(admin.Client, "/api/alunos/me")).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await admin.Client.PostAsync(Back, null)).StatusCode);
        await ApiFactory.SetCsrfAsync(admin.Client);
        Assert.Equal(HttpStatusCode.OK, (await EnterAs(admin.Client, AppRoles.Recruiter)).StatusCode);
        await ApiFactory.SetCsrfAsync(admin.Client);
        Assert.Equal(HttpStatusCode.Forbidden, (await Delete(admin.Client, "/api/recrutador/me")).StatusCode);

        Assert.Equal(2, await WithServicesAsync(services => services.GetRequiredService<AppDbContext>().Users
            .CountAsync(x => x.EhDemo && (x.Email!.StartsWith("marina.couto") || x.Email.StartsWith("helena.rocha")))));
    }

    [Fact]
    public async Task Demo_accounts_never_receive_activation_or_password_reset_flows()
    {
        await AdminAsync();
        var demo = await DemoUserAsync(AppRoles.Student);
        using var client = factory.Client();
        await ApiFactory.SetCsrfAsync(client);

        // A demo account with a password and a confirmed e-mail would qualify for a reset link for any real account.
        string resetToken = "", activationToken = "";
        await factory.InScopeAsync(async services =>
        {
            var users = services.GetRequiredService<UserManager<ApplicationUser>>();
            var user = (await users.FindByIdAsync(demo.Id.ToString()))!;
            Assert.True((await users.AddPasswordAsync(user, ApiFactory.Password)).Succeeded);
            resetToken = await users.GeneratePasswordResetTokenAsync(user);
            activationToken = await services.GetRequiredService<AccountTokenService>().GenerateActivationTokenAsync(user);
        });

        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/auth/forgot-password",
            new ForgotPasswordRequest(demo.Email!))).StatusCode);
        Assert.Empty(factory.Emails.Resets);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/reset-password",
            new ResetPasswordRequest(demo.Email!, resetToken, "NewPassword123"))).StatusCode);

        // Unconfirmed and without a password, the account would also be eligible for an activation link.
        await factory.InScopeAsync(async services =>
        {
            var users = services.GetRequiredService<UserManager<ApplicationUser>>();
            var user = (await users.FindByIdAsync(demo.Id.ToString()))!;
            Assert.True((await users.RemovePasswordAsync(user)).Succeeded);
            user.EmailConfirmed = false;
            Assert.True((await users.UpdateAsync(user)).Succeeded);
        });
        Assert.Equal(HttpStatusCode.Accepted, (await client.PostAsJsonAsync("/api/auth/resend-activation",
            new ResendActivationRequest(demo.Email!))).StatusCode);
        Assert.Empty(factory.Emails.Activations);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/auth/activate-account",
            new ActivateAccountRequest(demo.Email!, activationToken, "NewPassword123"))).StatusCode);
        Assert.False(await WithServicesAsync(async services => await services.GetRequiredService<UserManager<ApplicationUser>>()
            .HasPasswordAsync((await services.GetRequiredService<UserManager<ApplicationUser>>().FindByIdAsync(demo.Id.ToString()))!)));
    }

    // --- Forged and stale sessions -----------------------------------------------------------------------------

    private async Task<string> StampHashAsync(Guid id) => await WithServicesAsync(async services =>
    {
        var users = services.GetRequiredService<UserManager<ApplicationUser>>();
        return JwtTokenService.HashSecurityStamp(await users.GetSecurityStampAsync((await users.FindByIdAsync(id.ToString()))!));
    });

    // Signed with the real key, as only the server could: what matters is that the content is checked against the database.
    private HttpClient ClientWithToken(Guid subject, string role, string stampHash, params Claim[] extra)
    {
        List<Claim> claims = [new("sub", subject.ToString()), new("role", role), new("name", "Test"),
            new(JwtTokenService.SecurityStampClaim, stampHash), .. extra];
        var jwt = new JwtSecurityToken("TalentValley.Tests", "TalentValley.Tests.Client", claims,
            DateTime.UtcNow.AddMinutes(-1), DateTime.UtcNow.AddHours(1),
            new SigningCredentials(new SymmetricSecurityKey(Convert.FromBase64String(factory.SigningKey)), SecurityAlgorithms.HmacSha256));
        var client = factory.Client();
        client.DefaultRequestHeaders.Add("Cookie", $"tv_access={new JwtSecurityTokenHandler().WriteToken(jwt)}");
        return client;
    }

    private async Task<HttpStatusCode> MeWithAsync(Guid subject, string role, Guid? claimedAdmin, string? adminStampHash)
    {
        List<Claim> extra = [];
        if (claimedAdmin is not null) extra.Add(new(JwtTokenService.DemoAdminClaim, claimedAdmin.Value.ToString()));
        if (adminStampHash is not null) extra.Add(new(JwtTokenService.DemoAdminStampClaim, adminStampHash));
        using var client = ClientWithToken(subject, role, await StampHashAsync(subject), [.. extra]);
        return (await client.GetAsync(Me)).StatusCode;
    }

    [Fact]
    public async Task A_well_formed_demo_session_is_accepted()
    {
        var admin = await AdminAsync();
        var demo = await DemoUserAsync(AppRoles.Student);

        Assert.Equal(HttpStatusCode.OK,
            await MeWithAsync(demo.Id, AppRoles.Student, admin.Id, await StampHashAsync(admin.Id)));
    }

    [Fact]
    public async Task A_demo_account_without_the_admin_claim_is_rejected()
    {
        await AdminAsync();
        var demo = await DemoUserAsync(AppRoles.Student);

        Assert.Equal(HttpStatusCode.Unauthorized, await MeWithAsync(demo.Id, AppRoles.Student, null, null));
    }

    [Fact]
    public async Task A_demo_claim_naming_a_non_admin_is_rejected()
    {
        await AdminAsync();
        var demo = await DemoUserAsync(AppRoles.Student);
        var realStudent = await factory.CreateUserAsync(Email("real"));
        var realRecruiter = await factory.CreateUserAsync(Email("recruiter"), AppRoles.Recruiter);

        // Each one comes with its own valid stamp, so only "this account is not an administrator" can reject it.
        foreach (var notAdmin in new[] { realStudent, realRecruiter, demo.Id })
            Assert.Equal(HttpStatusCode.Unauthorized,
                await MeWithAsync(demo.Id, AppRoles.Student, notAdmin, await StampHashAsync(notAdmin)));
        Assert.Equal(HttpStatusCode.Unauthorized,
            await MeWithAsync(demo.Id, AppRoles.Student, Guid.NewGuid(), JwtTokenService.HashSecurityStamp("forged")));
    }

    [Fact]
    public async Task A_demo_claim_with_a_wrong_or_missing_admin_stamp_is_rejected()
    {
        var admin = await AdminAsync();
        var demo = await DemoUserAsync(AppRoles.Student);

        Assert.Equal(HttpStatusCode.Unauthorized,
            await MeWithAsync(demo.Id, AppRoles.Student, admin.Id, JwtTokenService.HashSecurityStamp("forged")));
        Assert.Equal(HttpStatusCode.Unauthorized, await MeWithAsync(demo.Id, AppRoles.Student, admin.Id, null));
    }

    [Fact]
    public async Task A_real_account_carrying_a_demo_claim_is_rejected()
    {
        var admin = await AdminAsync();
        var realStudent = await factory.CreateUserAsync(Email("real"));

        Assert.Equal(HttpStatusCode.OK, await MeWithAsync(realStudent, AppRoles.Student, null, null));
        Assert.Equal(HttpStatusCode.Unauthorized,
            await MeWithAsync(realStudent, AppRoles.Student, admin.Id, await StampHashAsync(admin.Id)));
    }

    [Fact]
    public async Task The_demo_session_ends_when_the_admin_credentials_are_reset()
    {
        var admin = await AdminAsync();
        Assert.Equal(HttpStatusCode.OK, (await EnterAs(admin.Client, AppRoles.Student)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.Client.GetAsync(Me)).StatusCode);

        await factory.InScopeAsync(async services =>
        {
            var users = services.GetRequiredService<UserManager<ApplicationUser>>();
            Assert.True((await users.UpdateSecurityStampAsync((await users.FindByIdAsync(admin.Id.ToString()))!)).Succeeded);
        });

        Assert.Equal(HttpStatusCode.Unauthorized, (await admin.Client.GetAsync(Me)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await admin.Client.PostAsync(Back, null)).StatusCode);
    }

    [Fact]
    public async Task The_demo_session_ends_when_the_user_is_no_longer_an_admin()
    {
        var admin = await AdminAsync();
        Assert.Equal(HttpStatusCode.OK, (await EnterAs(admin.Client, AppRoles.Recruiter)).StatusCode);

        await factory.InScopeAsync(async services =>
        {
            var users = services.GetRequiredService<UserManager<ApplicationUser>>();
            Assert.True((await users.RemoveFromRoleAsync((await users.FindByIdAsync(admin.Id.ToString()))!, AppRoles.Admin)).Succeeded);
        });

        Assert.Equal(HttpStatusCode.Unauthorized, (await admin.Client.GetAsync(Me)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await admin.Client.PostAsync(Back, null)).StatusCode);
    }
}
