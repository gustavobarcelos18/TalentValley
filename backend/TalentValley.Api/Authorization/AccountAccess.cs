using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Domain.Enums;

namespace TalentValley.Api.Authorization;

public sealed class AccountAccess(UserManager<ApplicationUser> users, AppDbContext database)
{
    public async Task<string?> GetRoleAsync(ApplicationUser user)
    {
        var roles = await users.GetRolesAsync(user);
        return roles.Count == 1 && AppRoles.All.Contains(roles[0]) ? roles[0] : null;
    }

    public Task<bool> IsActiveAsync(Guid id, string role) => role switch
    {
        AppRoles.Admin => Task.FromResult(true),
        AppRoles.Student => database.Alunos.AnyAsync(x => x.UserId == id && x.Ativo),
        AppRoles.Recruiter => database.Recrutadores.AnyAsync(x => x.UserId == id && x.Status == StatusRecrutador.ATIVO),
        _ => Task.FromResult(false)
    };
}
