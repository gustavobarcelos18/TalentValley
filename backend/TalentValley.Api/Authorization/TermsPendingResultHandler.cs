using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Policy;
using Microsoft.AspNetCore.Mvc;

namespace TalentValley.Api.Authorization;

// Same behavior as the framework for every outcome, except a block caused by pending terms: that 403 carries
// a stable `code` so the frontend can send the person to the acceptance screen instead of showing an error.
public sealed class TermsPendingResultHandler : IAuthorizationMiddlewareResultHandler
{
    private readonly AuthorizationMiddlewareResultHandler fallback = new();

    public Task HandleAsync(RequestDelegate next, HttpContext context, AuthorizationPolicy policy, PolicyAuthorizationResult authorizeResult)
    {
        var termsPending = authorizeResult.Forbidden && authorizeResult.AuthorizationFailure?.FailureReasons
            .Any(reason => reason.Handler is ActiveAccountHandler && reason.Message == ActiveAccountHandler.TermsPendingReason) == true;
        if (!termsPending) return fallback.HandleAsync(next, context, policy, authorizeResult);

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status403Forbidden,
            Title = "É necessário aceitar os Termos de Uso e a Política de Privacidade para continuar."
        };
        problem.Extensions["code"] = ActiveAccountHandler.TermsPendingReason;
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return context.Response.WriteAsJsonAsync(problem, options: null, contentType: "application/problem+json",
            cancellationToken: context.RequestAborted);
    }
}
