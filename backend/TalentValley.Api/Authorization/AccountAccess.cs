using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;
using TalentValley.Api.Services;

namespace TalentValley.Api.Authorization;

// What the database says about an account right now: whether it may use the system and which terms version it accepted.
public sealed record AccountState(bool Active, string? TermsVersion)
{
    public static readonly AccountState Inactive = new(false, null);
}

public sealed class AccountAccess(UserManager<ApplicationUser> users, AppDbContext database)
{
    public async Task<string?> GetRoleAsync(ApplicationUser user)
    {
        var roles = await users.GetRolesAsync(user);
        return roles.Count == 1 && AppRoles.All.Contains(roles[0]) ? roles[0] : null;
    }

    public async Task<bool> IsActiveAsync(Guid id, string role) => (await GetStateAsync(id, role)).Active;

    // A demonstration session is valid only for a demo account whose administrator still exists, is still an
    // administrator and has not had the credentials reset since the switch. Returns that administrator, else null.
    public async Task<ApplicationUser?> GetDemoSessionAdminAsync(ApplicationUser demoUser, ClaimsPrincipal principal)
    {
        if (!demoUser.EhDemo || !Guid.TryParse(principal.FindFirst(JwtTokenService.DemoAdminClaim)?.Value, out var adminId))
            return null;
        var admin = await users.FindByIdAsync(adminId.ToString());
        if (admin is null || await GetRoleAsync(admin) != AppRoles.Admin) return null;
        var claimed = principal.FindFirst(JwtTokenService.DemoAdminStampClaim)?.Value;
        return claimed == JwtTokenService.HashSecurityStamp(await users.GetSecurityStampAsync(admin)) ? admin : null;
    }

    public async Task<AccountState> GetStateAsync(Guid id, string role) => role switch
    {
        AppRoles.Admin => new AccountState(true, null),
        AppRoles.Student => await database.Alunos.Where(x => x.UserId == id && x.Ativo)
            .Select(x => new AccountState(true, x.VersaoTermos)).FirstOrDefaultAsync() ?? AccountState.Inactive,
        AppRoles.Recruiter => await database.Recrutadores.Where(x => x.UserId == id && x.Status == StatusRecrutador.ATIVO)
            .Select(x => new AccountState(true, x.VersaoTermos)).FirstOrDefaultAsync() ?? AccountState.Inactive,
        _ => AccountState.Inactive
    };

    // Only students and recruiters accept terms: the admin is the Institute operating the platform, and
    // demonstration accounts are fictitious. Any other terms version (or none, as in accounts created by the admin) is pending.
    public static bool HasPendingTerms(ApplicationUser user, string role, AccountState state) =>
        role != AppRoles.Admin && !user.EhDemo && state.TermsVersion != SolicitacaoCadastroService.VersaoTermosAtual;
}
