using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/admin/validacoes-rpv")]
[Authorize(Policy = AppPolicies.RequireAdmin)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AdminValidacoesRpvController(AdminRpvValidationService validations) : ControllerBase
{
    [HttpGet]
    public Task<PaginatedResponse<RpvValidationListItem>> List(
        [FromQuery, Range(1, int.MaxValue / 10)] int page = 1,
        CancellationToken cancellationToken = default) =>
        validations.ListPendingAsync(page, cancellationToken);

    [HttpGet("{formacaoId:guid}")]
    public async Task<ActionResult<RpvValidationDetailResponse>> Detail(
        Guid formacaoId,
        CancellationToken cancellationToken)
    {
        var response = await validations.GetDetailAsync(formacaoId, cancellationToken);
        return response is null ? Missing() : Ok(response);
    }

    [HttpGet("{formacaoId:guid}/certificado")]
    public async Task<IActionResult> Certificate(Guid formacaoId, CancellationToken cancellationToken)
    {
        var file = await validations.OpenCertificateAsync(formacaoId, cancellationToken);
        return file is null
            ? Missing()
            : File(file.Content, "application/pdf", "certificado.pdf", enableRangeProcessing: false);
    }

    [HttpPost("{formacaoId:guid}/aprovar")]
    public async Task<IActionResult> Approve(Guid formacaoId, CancellationToken cancellationToken) =>
        FromTransition(await validations.ApproveAsync(formacaoId, cancellationToken));

    [HttpPost("{formacaoId:guid}/rejeitar")]
    public async Task<IActionResult> Reject(Guid formacaoId, CancellationToken cancellationToken) =>
        FromTransition(await validations.RejectAsync(formacaoId, cancellationToken));

    [HttpPost("{formacaoId:guid}/remover-validacao")]
    public async Task<IActionResult> RemoveValidation(Guid formacaoId, CancellationToken cancellationToken) =>
        FromTransition(await validations.RemoveValidationAsync(formacaoId, cancellationToken));

    private IActionResult FromTransition(RpvValidationTransitionResult result) => result switch
    {
        RpvValidationTransitionResult.Success => NoContent(),
        RpvValidationTransitionResult.NotFound => Missing(),
        RpvValidationTransitionResult.CertificateRequired => Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "Certificado obrigatório.",
            detail: "A formação RPV precisa de um certificado para ser aprovada."),
        RpvValidationTransitionResult.CertificateUnavailable => Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "Certificado indisponível.",
            detail: "O certificado cadastrado não está disponível para validação."),
        _ => Problem(
            statusCode: StatusCodes.Status409Conflict,
            title: "Transição de validação inválida.",
            detail: "O estado atual da formação não permite esta operação.")
    };

    private ObjectResult Missing() => Problem(
        statusCode: StatusCodes.Status404NotFound,
        title: "Formação RPV não encontrada.");
}
