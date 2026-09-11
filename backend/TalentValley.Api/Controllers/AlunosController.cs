using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/alunos")]
[Authorize(Policy = AppPolicies.RequireActiveStudent)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AlunosController(AlunoService alunoService, TrajetoriaService trajetoriaService) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);

    [HttpGet("me/trajetoria")]
    public async Task<ActionResult<IReadOnlyCollection<TrajetoriaItemResponse>>> GetTrajetoria() =>
        Ok(await trajetoriaService.ListAsync(CurrentUserId));

    [HttpGet("me")]
    public async Task<ActionResult<MeResponse>> GetProfile()
    {
        var profile = await alunoService.GetProfileAsync(CurrentUserId);
        return profile is null
            ? Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.")
            : Ok(profile);
    }

    [HttpPut("me/dados-basicos")]
    public async Task<IActionResult> UpdateDadosBasicos(UpdateDadosBasicosRequest request)
    {
        try
        {
            await alunoService.UpdateDadosBasicosAsync(CurrentUserId, request);
            return NoContent();
        }
        catch (AlunoProfileNotFoundException)
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.");
        }
    }

    [HttpPut("me/sobre")]
    public async Task<IActionResult> UpdateSobre(UpdateSobreRequest request)
    {
        try
        {
            await alunoService.UpdateSobreAsync(CurrentUserId, request);
            return NoContent();
        }
        catch (AlunoProfileNotFoundException)
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.");
        }
    }

    [HttpPut("me/contato")]
    public async Task<IActionResult> UpdateContato(UpdateContatoRequest request)
    {
        try
        {
            await alunoService.UpdateContatoAsync(CurrentUserId, request);
            return NoContent();
        }
        catch (AlunoProfileNotFoundException)
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.");
        }
        catch (InvalidUrlException ex)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: ex.Message);
        }
    }

    [HttpPut("me/competencias")]
    public async Task<IActionResult> UpdateCompetencias(UpdateCompetenciasRequest request)
    {
        try
        {
            await alunoService.UpdateCompetenciasAsync(CurrentUserId, request.CompetenciaIds);
            return NoContent();
        }
        catch (AlunoProfileNotFoundException)
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.");
        }
        catch (ArgumentException ex)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: ex.Message);
        }
    }

    [HttpPut("me/idiomas")]
    public async Task<IActionResult> UpdateIdiomas(UpdateIdiomasRequest request)
    {
        try
        {
            await alunoService.UpdateIdiomasAsync(CurrentUserId, request.Idiomas);
            return NoContent();
        }
        catch (AlunoProfileNotFoundException)
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.");
        }
        catch (ArgumentException ex)
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: ex.Message);
        }
    }

    [HttpPut("me/disponibilidade")]
    public async Task<IActionResult> UpdateDisponibilidade(UpdateDisponibilidadeRequest request)
    {
        try
        {
            await alunoService.UpdateDisponibilidadeAsync(CurrentUserId, request);
            return NoContent();
        }
        catch (AlunoProfileNotFoundException)
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.");
        }
    }
}
