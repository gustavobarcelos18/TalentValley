using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/admin/demo")]
[Authorize(Policy = AppPolicies.RequireAdmin)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AdminDemoController(DemoService demo, DemoSessionService session, IHostEnvironment environment)
    : ControllerBase
{
    // Always answers, so the admin screen knows whether to offer the demonstration tools.
    [HttpGet("estado")]
    public Task<DemoStateResponse> GetState() => demo.GetStateAsync();

    [HttpPost("preparar")]
    public Task<ActionResult<DemoChangeResponse>> Prepare() => RunAsync(demo.PrepareAsync);

    [HttpPost("restaurar")]
    public Task<ActionResult<DemoChangeResponse>> Restore() => RunAsync(demo.RestoreAsync);

    // The administrator comes from the authenticated identity; the request only says which role to see the site as.
    [HttpPost("entrar")]
    public async Task<ActionResult<LoginResponse>> Enter(EnterDemoRequest request)
    {
        var result = await session.EnterAsync(User, request.Papel);
        switch (result.Status)
        {
            case StatusCodes.Status200OK:
                Response.Cookies.Append(AuthCookie.Name, result.Token!, AuthCookie.Options(environment, result.Expires));
                return Ok(result.Response);
            case StatusCodes.Status404NotFound:
                return NotFound();
            case StatusCodes.Status409Conflict:
                return Problem(statusCode: StatusCodes.Status409Conflict,
                    title: "A conta de demonstração não está disponível. Prepare a demonstração.");
            case StatusCodes.Status400BadRequest:
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Papel inválido.");
            default:
                return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.");
        }
    }

    // With demonstration mode off the endpoints behave as if they did not exist.
    private async Task<ActionResult<DemoChangeResponse>> RunAsync(Func<Task<DemoChangeResponse>> action)
    {
        if (!demo.Enabled) return NotFound();
        try
        {
            return Ok(await action());
        }
        catch (DemoEmailConflictException)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict,
                title: "O e-mail de uma conta de demonstração já pertence a uma conta real.");
        }
    }
}
