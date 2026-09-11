using Microsoft.AspNetCore.Antiforgery;

namespace TalentValley.Api.Authorization;

public sealed class ApiAntiforgeryMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IAntiforgery antiforgery)
    {
        var method = context.Request.Method;
        if (context.Request.Path.StartsWithSegments("/api") &&
            !HttpMethods.IsGet(method) && !HttpMethods.IsHead(method) && !HttpMethods.IsOptions(method))
        {
            try { await antiforgery.ValidateRequestAsync(context); }
            catch (AntiforgeryValidationException)
            {
                await Results.Problem(statusCode: StatusCodes.Status400BadRequest,
                    title: "Invalid antiforgery token.").ExecuteAsync(context);
                return;
            }
        }

        await next(context);
    }
}
