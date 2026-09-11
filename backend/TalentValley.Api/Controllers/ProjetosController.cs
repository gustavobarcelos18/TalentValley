using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/alunos/me/projetos")]
[Authorize(Policy = AppPolicies.RequireActiveStudent)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ProjetosController(ProjetoService service) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<ProjetoResponse>>> List() =>
        Ok(await service.ListAsync(CurrentUserId));

    [HttpPost]
    [ProducesResponseType<ProjetoResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<ProjetoResponse>> Create(ProjetoRequest request)
    {
        try
        {
            var response = await service.CreateAsync(CurrentUserId, request);
            return CreatedAtAction(nameof(List), response);
        }
        catch (ProjectLimitException)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "A student may have at most two projects.");
        }
        catch (ArgumentException ex)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: ex.Message);
        }
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ProjetoResponse>> Update(Guid id, ProjetoRequest request)
    {
        try
        {
            var response = await service.UpdateAsync(CurrentUserId, id, request);
            return response is null ? Problem(statusCode: 404, title: "Resource not found.") : Ok(response);
        }
        catch (ArgumentException ex)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: ex.Message);
        }
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id) =>
        await service.DeleteAsync(CurrentUserId, id)
            ? NoContent() : Problem(statusCode: StatusCodes.Status404NotFound, title: "Resource not found.");
}
