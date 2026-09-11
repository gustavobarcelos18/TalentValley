using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/recrutador")]
[Authorize(Policy = AppPolicies.RequireActiveRecruiter)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class RecrutadorController(
    TalentComparisonService comparisons,
    RecruiterDashboardService dashboard) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);

    [HttpGet("comparar")]
    public async Task<ActionResult<TalentComparisonResponse>> Compare(
        [FromQuery] string[]? slugs, CancellationToken cancellationToken)
    {
        if (slugs is null || slugs.Length != 2 || string.IsNullOrWhiteSpace(slugs[0]) ||
            string.IsNullOrWhiteSpace(slugs[1]) || string.Equals(slugs[0], slugs[1], StringComparison.Ordinal))
            return Problem(statusCode: StatusCodes.Status400BadRequest,
                title: "Exactly two distinct talent slugs are required.");

        var response = await comparisons.CompareAsync(CurrentUserId, slugs[0], slugs[1], cancellationToken);
        return response is null
            ? Problem(statusCode: StatusCodes.Status404NotFound, title: "Resource not found.")
            : Ok(response);
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<RecruiterDashboardResponse>> Dashboard(CancellationToken cancellationToken) =>
        Ok(await dashboard.GetAsync(CurrentUserId, cancellationToken));
}
