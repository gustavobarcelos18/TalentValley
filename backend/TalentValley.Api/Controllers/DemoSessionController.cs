using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

// The way back from a demonstration session. The caller is a demo account, not an administrator, so the
// administrator policy does not apply: the service accepts only a session whose administrator is still valid.
[ApiController]
[Route("api/demo")]
[Authorize]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class DemoSessionController(DemoSessionService session, IHostEnvironment environment) : ControllerBase
{
    [HttpPost("voltar")]
    public async Task<ActionResult<LoginResponse>> Return()
    {
        var result = await session.ReturnAsync(User);
        if (result.Status != StatusCodes.Status200OK)
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.");

        Response.Cookies.Append(AuthCookie.Name, result.Token!, AuthCookie.Options(environment, result.Expires));
        return Ok(result.Response);
    }
}
