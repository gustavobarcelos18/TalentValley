using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/alunos/me/formacoes")]
[Authorize(Policy = AppPolicies.RequireActiveStudent)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class FormacoesController(FormacaoService service) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyCollection<FormacaoResponse>>> List() =>
        Ok(await service.ListAsync(CurrentUserId));

    [HttpPost]
    [ProducesResponseType<FormacaoResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<FormacaoResponse>> Create(FormacaoRequest request)
    {
        var response = await service.CreateAsync(CurrentUserId, request);
        return CreatedAtAction(nameof(List), response);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<FormacaoResponse>> Update(Guid id, FormacaoRequest request)
    {
        var response = await service.UpdateAsync(CurrentUserId, id, request);
        return response is null ? Problem(statusCode: 404, title: "Resource not found.") : Ok(response);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id) =>
        await service.DeleteAsync(CurrentUserId, id)
            ? NoContent() : Problem(statusCode: StatusCodes.Status404NotFound, title: "Resource not found.");
}
