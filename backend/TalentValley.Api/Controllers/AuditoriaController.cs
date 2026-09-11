using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/admin/auditoria")]
[Authorize(Policy = AppPolicies.RequireAdmin)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuditoriaController(AuditoriaService audit) : ControllerBase
{
    [HttpGet]
    public Task<PaginatedResponse<AuditoriaListItem>> List([FromQuery, Range(1, int.MaxValue / 20)] int page = 1) =>
        audit.ListAsync(page);
}
