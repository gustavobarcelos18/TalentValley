using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using TalentValley.Api.Authorization;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Services;

// Lets an administrator step into a demonstration account and back. The administrator is always read from the
// database, never trusted from the request, and the only accounts it can step into are the flagged demo ones.
public sealed class DemoSessionService(AppDbContext database, UserManager<ApplicationUser> users, AccountAccess access,
    JwtTokenService tokens, AuthService auth, AuditoriaService audit, IOptions<DemoOptions> options)
{
    private const string EntityType = "DEMO";

    // The caller is the signed-in administrator. Their session expiry carries over to the demo session.
    public async Task<LoginResult> EnterAsync(ClaimsPrincipal principal, string role)
    {
        if (!options.Value.Enabled) return new(StatusCodes.Status404NotFound);
        if (!Guid.TryParse(principal.FindFirst("sub")?.Value, out var adminId)) return new(StatusCodes.Status403Forbidden);
        var admin = await users.FindByIdAsync(adminId.ToString());
        if (admin is null || await access.GetRoleAsync(admin) != AppRoles.Admin) return new(StatusCodes.Status403Forbidden);

        // The first demo student is the one with the complete profile.
        var email = role switch
        {
            AppRoles.Student => DemoData.Students[0].Email,
            AppRoles.Recruiter => DemoData.Recruiter.Email,
            _ => null
        };
        if (email is null) return new(StatusCodes.Status400BadRequest);
        var normalized = email.ToUpperInvariant();
        var demo = await database.Users.SingleOrDefaultAsync(x => x.EhDemo && x.NormalizedEmail == normalized);
        // Not prepared yet, or the account does not hold the expected role or is not active.
        if (demo is null || await access.GetRoleAsync(demo) != role || !await access.IsActiveAsync(demo.Id, role))
            return new(StatusCodes.Status409Conflict);

        var (token, expires) = tokens.Create(demo, role, await users.GetSecurityStampAsync(demo),
            new DemoAdmin(admin.Id, await users.GetSecurityStampAsync(admin)), ExpiryOf(principal));
        await audit.RecordAsync(AcaoAuditoria.DEMO_ENTROU, EntityType, Guid.Empty,
            $"Administrador entrou na demonstração como {(role == AppRoles.Student ? "Aluno" : "Recrutador")}.");
        await database.SaveChangesAsync();
        return await SignedInAsync(demo.Id, role, token, expires);
    }

    // The caller is a demo account, so the administrator named in the session is checked against the database.
    public async Task<LoginResult> ReturnAsync(ClaimsPrincipal principal)
    {
        if (!Guid.TryParse(principal.FindFirst("sub")?.Value, out var demoId)) return new(StatusCodes.Status403Forbidden);
        var demo = await users.FindByIdAsync(demoId.ToString());
        var admin = demo is null ? null : await access.GetDemoSessionAdminAsync(demo, principal);
        if (admin is null) return new(StatusCodes.Status403Forbidden);

        var (token, expires) = tokens.Create(admin, AppRoles.Admin, await users.GetSecurityStampAsync(admin),
            expiresAt: ExpiryOf(principal));
        await audit.RecordForAdminAsync(admin.Id, AcaoAuditoria.DEMO_VOLTOU, EntityType, Guid.Empty,
            "Administrador voltou da demonstração.");
        await database.SaveChangesAsync();
        return await SignedInAsync(admin.Id, AppRoles.Admin, token, expires);
    }

    private async Task<LoginResult> SignedInAsync(Guid userId, string role, string token, DateTimeOffset expires)
    {
        var user = await auth.GetUserAsync(userId) ?? throw new InvalidOperationException("The account vanished.");
        return new(StatusCodes.Status200OK, new(user, AuthService.DestinationFor(role)), token, expires);
    }

    // The token was already validated, so "exp" is always present.
    private static DateTimeOffset ExpiryOf(ClaimsPrincipal principal) =>
        DateTimeOffset.FromUnixTimeSeconds(long.Parse(principal.FindFirst("exp")!.Value));
}
