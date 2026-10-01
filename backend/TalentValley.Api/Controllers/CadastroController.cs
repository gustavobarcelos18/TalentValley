using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/cadastro")]
[AllowAnonymous]
[EnableRateLimiting(RateLimitPolicies.Anonymous)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class CadastroController(SolicitacaoCadastroService solicitacoes) : ControllerBase
{
    // Always the same response, so the endpoint never reveals whether an e-mail is already registered.
    private const string AcceptedMessage = "Solicitação recebida. Se aprovada, você receberá as instruções por e-mail.";

    [HttpPost("aluno")]
    public async Task<ActionResult<SolicitacaoCadastroAcceptedResponse>> Aluno(SolicitarCadastroAlunoRequest request, CancellationToken cancellationToken)
    {
        await solicitacoes.CreateAlunoAsync(request, cancellationToken);
        return Accepted(new SolicitacaoCadastroAcceptedResponse(AcceptedMessage));
    }
    [HttpPost("recrutador")]
    public async Task<ActionResult<SolicitacaoCadastroAcceptedResponse>> Recrutador(SolicitarCadastroRecrutadorRequest request, CancellationToken cancellationToken)
    {
        await solicitacoes.CreateRecrutadorAsync(request, cancellationToken);
        return Accepted(new SolicitacaoCadastroAcceptedResponse(AcceptedMessage));
    }
}
