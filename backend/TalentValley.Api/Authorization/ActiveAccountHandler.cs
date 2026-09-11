using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Authorization;

public sealed record ActiveAccountRequirement(string? Role = null) : IAuthorizationRequirement;

public sealed class ActiveAccountHandler(UserManager<ApplicationUser> users, AccountAccess access)
    : AuthorizationHandler<ActiveAccountRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, ActiveAccountRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true ||
            !Guid.TryParse(context.User.FindFirst("sub")?.Value, out var id)) return;

        var user = await users.FindByIdAsync(id.ToString());
        if (user is null) return;
        var role = await access.GetRoleAsync(user);
        if (role is null || context.User.FindFirst("role")?.Value != role ||
            (requirement.Role is not null && role != requirement.Role)) return;

        if (await access.IsActiveAsync(id, role)) context.Succeed(requirement);
    }
}
