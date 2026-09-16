using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/admin/recrutadores")]
[Authorize(Policy = AppPolicies.RequireAdmin)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AdminRecrutadoresController(AdminRecrutadorService recruiters) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<RecrutadorCreatedResponse>> Create(CreateRecrutadorRequest request)
    {
        try
        {
            var response = await recruiters.CreateAsync(request);
            return CreatedAtAction(nameof(Detail), new { id = response.Id }, response);
        }
        catch (DuplicateAccountEmailException)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Este email já está em uso.");
        }
    }

    [HttpGet]
    public Task<PaginatedResponse<RecrutadorListItem>> List([FromQuery] RecrutadorListQuery query) => recruiters.ListAsync(query);

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<RecrutadorDetailResponse>> Detail(Guid id) =>
        await recruiters.GetAsync(id) is { } recruiter ? Ok(recruiter) : Missing();

    [HttpPost("{id:guid}/bloquear")]
    public async Task<IActionResult> Block(Guid id) => await recruiters.SetActiveAsync(id, false) ? NoContent() : Missing();

    [HttpPost("{id:guid}/reativar")]
    public async Task<IActionResult> Reactivate(Guid id) => await recruiters.SetActiveAsync(id, true) ? NoContent() : Missing();

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id) => await recruiters.DeleteAsync(id) switch
    {
        AdminAccountDeletionResult.Deleted => NoContent(),
        AdminAccountDeletionResult.Active => Problem(statusCode: StatusCodes.Status409Conflict,
            title: "Bloqueie o recrutador antes de excluí-lo."),
        _ => Missing()
    };

    private ObjectResult Missing() => Problem(statusCode: StatusCodes.Status404NotFound, title: "Recrutador não encontrado.");
}
