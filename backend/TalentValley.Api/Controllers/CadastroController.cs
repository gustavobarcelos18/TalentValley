using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/cadastro")]
[AllowAnonymous]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class CadastroController(SolicitacaoCadastroService solicitacoes) : ControllerBase
{
    [HttpPost("aluno")]
    public async Task<ActionResult<SolicitacaoCadastroCreatedResponse>> Aluno(SolicitarCadastroAlunoRequest request, CancellationToken cancellationToken)
    {
        try { return StatusCode(StatusCodes.Status201Created, await solicitacoes.CreateAlunoAsync(request, cancellationToken)); }
        catch (DuplicateRegistrationException) { return Problem(statusCode: StatusCodes.Status409Conflict, title: DuplicateRegistrationException.MessageForClient); }
    }
    [HttpPost("recrutador")]
    public async Task<ActionResult<SolicitacaoCadastroCreatedResponse>> Recrutador(SolicitarCadastroRecrutadorRequest request, CancellationToken cancellationToken)
    {
        try { return StatusCode(StatusCodes.Status201Created, await solicitacoes.CreateRecrutadorAsync(request, cancellationToken)); }
        catch (DuplicateRegistrationException) { return Problem(statusCode: StatusCodes.Status409Conflict, title: DuplicateRegistrationException.MessageForClient); }
    }
}
