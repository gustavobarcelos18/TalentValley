using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;

namespace TalentValley.Api.Tests;

// Loaded only by the test host. These endpoints are never part of the API assembly.
[ApiController]
[Route("api/probe")]
public sealed class PolicyProbeController : ControllerBase
{
    [Authorize(Policy = AppPolicies.RequireActiveStudent)]
    [HttpGet("student")]
    public IActionResult Student() => NoContent();

    [Authorize(Policy = AppPolicies.RequireActiveRecruiter)]
    [HttpGet("recruiter")]
    public IActionResult Recruiter() => NoContent();

    [Authorize(Policy = AppPolicies.RequireAdmin)]
    [HttpGet("admin")]
    public IActionResult Admin() => NoContent();

    [Authorize]
    [AcceptVerbs("POST", "PUT", "PATCH", "DELETE", Route = "change")]
    public IActionResult Change() => NoContent();

    [HttpGet("fallback")]
    public IActionResult Fallback() => NoContent();
}
