using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/alunos/me/importacao-linkedin")]
[Authorize(Policy = AppPolicies.RequireActiveStudent)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ImportacaoLinkedInController(LinkedInImportPreviewService service) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);

    // Only reads the export and answers with a preview. Nothing is saved and the file is not kept.
    [HttpPost("previa")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(FileUploadValidator.ZipMaximumBytes + 64 * 1024)]
    public async Task<ActionResult<ImportacaoLinkedInPreviaResponse>> Preview([FromForm] IFormFile? file,
        CancellationToken cancellationToken)
    {
        try
        {
            var response = await service.PreviewAsync(CurrentUserId, file, cancellationToken);
            return response is null ? Problem(statusCode: StatusCodes.Status404NotFound, title: "Resource not found.") : Ok(response);
        }
        catch (UploadValidationException ex)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: ex.Message);
        }
    }
}
