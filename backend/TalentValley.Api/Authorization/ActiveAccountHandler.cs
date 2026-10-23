using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Authorization;

public sealed record ActiveAccountRequirement(string? Role = null) : IAuthorizationRequirement;

public sealed class ActiveAccountHandler(UserManager<ApplicationUser> users, AccountAccess access)
    : AuthorizationHandler<ActiveAccountRequirement>
{
    // Reported through AuthorizationFailureReason so the response can tell "accept the terms" apart from other 403s.
    public const string TermsPendingReason = "TERMOS_PENDENTES";

    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, ActiveAccountRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated != true ||
            !Guid.TryParse(context.User.FindFirst("sub")?.Value, out var id)) return;

        var user = await users.FindByIdAsync(id.ToString());
        if (user is null) return;
        var role = await access.GetRoleAsync(user);
        if (role is null || context.User.FindFirst("role")?.Value != role ||
            (requirement.Role is not null && role != requirement.Role)) return;

        var state = await access.GetStateAsync(id, role);
        if (!state.Active) return;

        if (AccountAccess.HasPendingTerms(user, role, state) && !AllowsPendingTerms(context))
        {
            context.Fail(new AuthorizationFailureReason(this, TermsPendingReason));
            return;
        }
        context.Succeed(requirement);
    }

    // Fails closed: when the endpoint cannot be identified, the terms are required.
    private static bool AllowsPendingTerms(AuthorizationHandlerContext context)
    {
        var endpoint = context.Resource switch
        {
            HttpContext http => http.GetEndpoint(),
            Endpoint found => found,
            _ => null
        };
        return endpoint?.Metadata.GetMetadata<AllowPendingTermsAttribute>() is not null;
    }
}
