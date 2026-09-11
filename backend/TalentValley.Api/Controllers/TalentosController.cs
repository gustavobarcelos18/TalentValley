using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/talentos")]
[Authorize(Policy = AppPolicies.RequireActiveRecruiter)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TalentosController(TalentDiscoveryService talents, TalentFileService files) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<PaginatedResponse<TalentListItem>>> Search(
        [FromQuery] TalentSearchQuery query, CancellationToken cancellationToken)
    {
        try
        {
            return Ok(await talents.SearchAsync(query, cancellationToken));
        }
        catch (InvalidTalentQueryException exception)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: exception.Message);
        }
    }

    [HttpGet("{slug}")]
    public async Task<ActionResult<TalentProfileResponse>> Get(string slug, CancellationToken cancellationToken)
    {
        var response = await talents.GetBySlugAsync(slug, cancellationToken);
        return response is null ? NotFoundProblem() : Ok(response);
    }

    [HttpGet("{slug}/foto")]
    public async Task<IActionResult> GetPhoto(string slug, CancellationToken cancellationToken)
    {
        var file = await files.OpenPhotoAsync(slug, cancellationToken);
        return file is null ? NotFoundProblem() : File(file.Content, file.ContentType, enableRangeProcessing: false);
    }

    [HttpGet("{slug}/curriculo")]
    public async Task<IActionResult> GetCurriculum(string slug, CancellationToken cancellationToken)
    {
        var file = await files.OpenCurriculumAsync(slug, cancellationToken);
        return file is null ? NotFoundProblem() :
            File(file.Content, file.ContentType, "curriculo.pdf", enableRangeProcessing: false);
    }

    [HttpGet("{slug}/formacoes/{formacaoId:guid}/certificado")]
    public async Task<IActionResult> GetCertificate(
        string slug, Guid formacaoId, CancellationToken cancellationToken)
    {
        var file = await files.OpenCertificateAsync(slug, formacaoId, cancellationToken);
        return file is null ? NotFoundProblem() :
            File(file.Content, file.ContentType, "certificado.pdf", enableRangeProcessing: false);
    }

    private ObjectResult NotFoundProblem() =>
        Problem(statusCode: StatusCodes.Status404NotFound, title: "Resource not found.");
}
