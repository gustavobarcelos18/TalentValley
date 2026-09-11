using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/recrutador/favoritos")]
[Authorize(Policy = AppPolicies.RequireActiveRecruiter)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class RecrutadorFavoritosController(FavoriteService favorites) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);

    [HttpGet]
    public async Task<ActionResult<PaginatedResponse<FavoriteTalentResponse>>> List(
        [FromQuery] FavoriteListQuery query, CancellationToken cancellationToken) =>
        Ok(await favorites.ListAsync(CurrentUserId, query.Page, cancellationToken));

    [HttpPost("{slug}")]
    public async Task<IActionResult> Add(string slug, CancellationToken cancellationToken) =>
        await favorites.AddAsync(CurrentUserId, slug, cancellationToken)
            ? NoContent() : NotFoundProblem();

    [HttpDelete("{slug}")]
    public async Task<IActionResult> Remove(string slug, CancellationToken cancellationToken) =>
        await favorites.RemoveAsync(CurrentUserId, slug, cancellationToken)
            ? NoContent() : NotFoundProblem();

    private ObjectResult NotFoundProblem() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Resource not found.");
}
