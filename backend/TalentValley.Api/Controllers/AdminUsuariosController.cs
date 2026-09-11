using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/admin/usuarios")]
[Authorize(Policy = AppPolicies.RequireAdmin)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AdminUsuariosController(AdminAccountService accounts) : ControllerBase
{
    [HttpPost("{id:guid}/reenviar-ativacao")]
    public async Task<IActionResult> Resend(Guid id) => await accounts.ResendAsync(id) switch
    {
        ResendActivationResult.Accepted => Accepted(),
        ResendActivationResult.NotFound => Problem(statusCode: 404, title: "Usuário não encontrado."),
        ResendActivationResult.AlreadyActivated => Problem(statusCode: 409, title: "A conta já foi ativada."),
        _ => Problem(statusCode: 503, title: "Não foi possível enviar o email de ativação. Tente novamente mais tarde.")
    };
}
