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

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AdminAlunoDetailResponse>> Detail(Guid id, CancellationToken cancellationToken) =>
        await alunos.GetAsync(id, cancellationToken) is { } aluno ? Ok(aluno) : Missing();

    [HttpGet("{id:guid}/foto")]
    public async Task<IActionResult> Photo(Guid id, CancellationToken cancellationToken) =>
        await alunos.OpenPhotoAsync(id, cancellationToken) is { } file
            ? File(file.Content, file.ContentType, enableRangeProcessing: false) : Missing();

    [HttpGet("{id:guid}/curriculo")]
    public async Task<IActionResult> Curriculum(Guid id, CancellationToken cancellationToken) =>
        await alunos.OpenCurriculumAsync(id, cancellationToken) is { } file
            ? File(file.Content, "application/pdf", "curriculo.pdf", enableRangeProcessing: false) : Missing();

    [HttpGet("{alunoId:guid}/formacoes/{formacaoId:guid}/certificado")]
    public async Task<IActionResult> Certificate(Guid alunoId, Guid formacaoId, CancellationToken cancellationToken) =>
        await alunos.OpenCertificateAsync(alunoId, formacaoId, cancellationToken) is { } file
            ? File(file.Content, "application/pdf", "certificado.pdf", enableRangeProcessing: false) : Missing();

    [HttpPost("{id:guid}/bloquear")]
    public async Task<IActionResult> Block(Guid id) => await alunos.SetActiveAsync(id, false) ? NoContent() : Missing();

    [HttpPost("{id:guid}/reativar")]
    public async Task<IActionResult> Reactivate(Guid id) => await alunos.SetActiveAsync(id, true) ? NoContent() : Missing();

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id) => await alunos.DeleteAsync(id) ? NoContent() : Missing();

    private ObjectResult Missing() => Problem(statusCode: StatusCodes.Status404NotFound, title: "Aluno não encontrado.");
}
