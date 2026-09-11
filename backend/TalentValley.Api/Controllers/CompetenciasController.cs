using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/competencias")]
[Authorize(Policy = AppPolicies.RequireActiveStudent)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class CompetenciasController(AlunoService alunoService) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyCollection<CatalogoCompetenciaResponse>> List([FromQuery] string? search) =>
        alunoService.GetCompetenciasAsync(search);
}
