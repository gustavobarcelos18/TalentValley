using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/idiomas")]
[Authorize(Policy = AppPolicies.RequireActiveStudent)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class IdiomasController(AlunoService alunoService) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyCollection<CatalogoIdiomaResponse>> List() =>
        alunoService.GetIdiomasAsync();
}
