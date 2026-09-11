using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/admin/dashboard")]
[Authorize(Policy = AppPolicies.RequireAdmin)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AdminDashboardController(AdminDashboardService dashboard) : ControllerBase
{
    [HttpGet]
    public Task<AdminDashboardResponse> Get(CancellationToken cancellationToken) =>
        dashboard.GetAsync(cancellationToken);
}
