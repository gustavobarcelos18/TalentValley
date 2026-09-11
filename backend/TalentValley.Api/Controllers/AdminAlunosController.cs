using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/admin/alunos")]
[Authorize(Policy = AppPolicies.RequireAdmin)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AdminAlunosController(AdminAlunoService alunos) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<AlunoCreatedResponse>> Create(CreateAlunoRequest request)
    {
        try
        {
            var response = await alunos.CreateAsync(request);
            return StatusCode(StatusCodes.Status201Created, response);
        }
        catch (DuplicateAccountEmailException)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Este email já está em uso.");
        }
    }

    [HttpGet]
    public Task<PaginatedResponse<AlunoListItem>> List([FromQuery] AdminListQuery query) => alunos.ListAsync(query);

    [HttpPost("{id:guid}/bloquear")]
    public async Task<IActionResult> Block(Guid id) => await alunos.SetActiveAsync(id, false) ? NoContent() : Missing();

    [HttpPost("{id:guid}/reativar")]
    public async Task<IActionResult> Reactivate(Guid id) => await alunos.SetActiveAsync(id, true) ? NoContent() : Missing();

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id) => await alunos.DeleteAsync(id) ? NoContent() : Missing();

    private ObjectResult Missing() => Problem(statusCode: StatusCodes.Status404NotFound, title: "Aluno não encontrado.");
}
