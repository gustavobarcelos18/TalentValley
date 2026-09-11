using Microsoft.AspNetCore.Identity;
using TalentValley.Api.Authorization;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.DTOs;

namespace TalentValley.Api.Services;

public sealed record LoginResult(int Status, LoginResponse? Response = null, string? Token = null, DateTimeOffset? Expires = null);

public sealed class AuthService(UserManager<ApplicationUser> users, SignInManager<ApplicationUser> signIn,
    AccountAccess access, JwtTokenService tokens)
{
    public async Task<LoginResult> LoginAsync(LoginRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email.Trim());
        if (user is null) return new(StatusCodes.Status401Unauthorized);
        var result = await signIn.CheckPasswordSignInAsync(user, request.Senha, lockoutOnFailure: true);
        if (result.IsLockedOut) return new(StatusCodes.Status423Locked);
        if (!result.Succeeded) return new(StatusCodes.Status401Unauthorized);

        var role = await access.GetRoleAsync(user);
        if (role is null || !await access.IsActiveAsync(user.Id, role)) return new(StatusCodes.Status403Forbidden);

        user.LoginAnteriorEm = user.UltimoLoginEm;
        user.UltimoLoginEm = DateTimeOffset.UtcNow;
        if (!(await users.UpdateAsync(user)).Succeeded)
            return new(StatusCodes.Status401Unauthorized);

        var (token, expires) = tokens.Create(user, role);
        var destination = role switch
        {
            AppRoles.Student => "/meu-perfil",
            AppRoles.Recruiter => "/recrutador",
            AppRoles.Admin => "/admin",
            _ => throw new InvalidOperationException("Unsupported application role.")
        };
        return new(StatusCodes.Status200OK, new(Map(user, role), destination), token, expires);
    }

    public async Task<UsuarioAutenticadoResponse?> GetUserAsync(Guid id)
    {
        var user = await users.FindByIdAsync(id.ToString());
        if (user is null) return null;
        var role = await access.GetRoleAsync(user);
        return role is null ? null : Map(user, role);
    }

    private static UsuarioAutenticadoResponse Map(ApplicationUser user, string role) =>
        new(user.Id, user.NomeCompleto, user.Email!, role);
}
