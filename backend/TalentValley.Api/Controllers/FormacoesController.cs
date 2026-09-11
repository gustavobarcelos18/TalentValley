using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;
using TalentValley.Api.Storage;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/alunos/me/formacoes")]
[Authorize(Policy = AppPolicies.RequireActiveStudent)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class FormacoesController(FormacaoService service, StudentFileService files) : ControllerBase
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

    [HttpPost("{id:guid}/certificado")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(10L * 1024 * 1024 + 64 * 1024)]
    public async Task<IActionResult> UploadCertificate(Guid id, [FromForm] IFormFile? file,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await files.UploadCertificateAsync(CurrentUserId, id, file, cancellationToken);
            return result == FileMutationResult.NotFound
                ? Problem(statusCode: StatusCodes.Status404NotFound, title: "Resource not found.")
                : NoContent();
        }
        catch (UploadValidationException ex)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: ex.Message);
        }
    }

    [HttpGet("{id:guid}/certificado")]
    public async Task<IActionResult> GetCertificate(Guid id, CancellationToken cancellationToken)
    {
        var file = await files.OpenCertificateAsync(CurrentUserId, id, cancellationToken);
        return file is null
            ? Problem(statusCode: StatusCodes.Status404NotFound, title: "Resource not found.")
            : File(file.Content, file.ContentType, "certificado.pdf", enableRangeProcessing: false);
    }

    [HttpDelete("{id:guid}/certificado")]
    public async Task<IActionResult> DeleteCertificate(Guid id, CancellationToken cancellationToken)
    {
        var result = await files.DeleteCertificateAsync(CurrentUserId, id, cancellationToken);
        return result == FileMutationResult.NotFound
            ? Problem(statusCode: StatusCodes.Status404NotFound, title: "Resource not found.")
            : NoContent();
    }
}
