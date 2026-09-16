using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/admin/solicitacoes-cadastro")]
[Authorize(Policy = AppPolicies.RequireAdmin)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AdminSolicitacoesCadastroController(SolicitacaoCadastroService solicitacoes) : ControllerBase
{
    [HttpGet] public Task<PaginatedResponse<SolicitacaoCadastroListItem>> List([FromQuery] SolicitacaoCadastroListQuery query, CancellationToken cancellationToken) => solicitacoes.ListAsync(query, cancellationToken);
    [HttpGet("{id:guid}")] public async Task<ActionResult<SolicitacaoCadastroDetailResponse>> Detail(Guid id, CancellationToken cancellationToken) => await solicitacoes.GetAsync(id, cancellationToken) is { } item ? Ok(item) : Missing();
    [HttpPost("{id:guid}/aprovar")] public async Task<IActionResult> Approve(Guid id, CancellationToken cancellationToken) => await solicitacoes.ApproveAsync(id, cancellationToken) switch
    { SolicitacaoApprovalResult.Approved => NoContent(), SolicitacaoApprovalResult.NotFound => Missing(), SolicitacaoApprovalResult.EmailUnavailable => Conflict("JÃ¡ existe uma conta ou solicitaÃ§Ã£o em andamento para este e-mail."), _ => Conflict("Esta solicitaÃ§Ã£o jÃ¡ foi analisada.") };
    [HttpPost("{id:guid}/rejeitar")] public async Task<IActionResult> Reject(Guid id, RejeitarSolicitacaoCadastroRequest request, CancellationToken cancellationToken) => await solicitacoes.RejectAsync(id, request.Motivo, cancellationToken) switch
    { SolicitacaoRejectionResult.Rejected => NoContent(), SolicitacaoRejectionResult.NotFound => Missing(), _ => Conflict("Esta solicitaÃ§Ã£o jÃ¡ foi analisada.") };
    private ObjectResult Missing() => Problem(statusCode: StatusCodes.Status404NotFound, title: "SolicitaÃ§Ã£o de cadastro nÃ£o encontrada.");
    private ObjectResult Conflict(string title) => Problem(statusCode: StatusCodes.Status409Conflict, title: title);
}
