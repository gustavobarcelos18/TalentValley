using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/recrutador")]
[Authorize(Policy = AppPolicies.RequireActiveRecruiter)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class RecrutadorController(
    TalentComparisonService comparisons,
    RecruiterDashboardService dashboard,
    RecrutadorDeletionService deletion,
    DataExportService dataExport,
    NewsletterService newsletter,
    IHostEnvironment environment) : ControllerBase
{
    private Guid CurrentUserId => Guid.Parse(User.FindFirst("sub")!.Value);

    // LGPD data export: only the signed-in recruiter's own data (identity-derived, no ID accepted).
    [AllowPendingTerms]
    [HttpGet("me/exportacao")]
    public async Task<ActionResult<ExportacaoRecrutadorResponse>> ExportMyData(CancellationToken cancellationToken)
    {
        var export = await dataExport.ExportRecrutadorAsync(CurrentUserId, cancellationToken);
        return export is null
            ? Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.")
            : Ok(export);
    }

    // LGPD newsletter consent: reads/changes only the signed-in recruiter's own choice (identity-derived).
    [AllowPendingTerms]
    [HttpGet("me/newsletter")]
    public async Task<ActionResult<NewsletterResponse>> GetNewsletter(CancellationToken cancellationToken)
    {
        var response = await newsletter.GetRecrutadorAsync(CurrentUserId, cancellationToken);
        return response is null
            ? Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.")
            : Ok(response);
    }

    [AllowPendingTerms]
    [HttpPut("me/newsletter")]
    public async Task<ActionResult<NewsletterResponse>> UpdateNewsletter(
        UpdateNewsletterRequest request, CancellationToken cancellationToken)
    {
        // [Required] on the DTO guarantees a value here; a missing one never reaches the action (400).
        var response = await newsletter.SetRecrutadorAsync(CurrentUserId, request.Aceita!.Value, cancellationToken);
        return response is null
            ? Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.")
            : Ok(response);
    }

    // LGPD self-deletion. Class-level policy requires an active recruiter; the CSRF middleware covers DELETE.
    [AllowPendingTerms]
    [HttpDelete("me")]
    public async Task<IActionResult> DeleteMyAccount(DeleteOwnProfileRequest request, CancellationToken cancellationToken)
    {
        switch (await deletion.DeleteOwnAsync(CurrentUserId, request.SenhaAtual, cancellationToken))
        {
            case RecrutadorSelfDeleteResult.Deleted:
                Response.Cookies.Delete(AuthCookie.Name, AuthCookie.Options(environment));
                return NoContent();
            case RecrutadorSelfDeleteResult.InvalidPassword:
                return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Senha incorreta.");
            case RecrutadorSelfDeleteResult.LockedOut:
                return Problem(statusCode: StatusCodes.Status423Locked,
                    title: "Conta temporariamente bloqueada por tentativas inválidas.");
            default:
                return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.");
        }
    }

    [HttpGet("comparar")]
    public async Task<ActionResult<TalentComparisonResponse>> Compare(
        [FromQuery] string[]? slugs, CancellationToken cancellationToken)
    {
        if (slugs is null || slugs.Length != 2 || string.IsNullOrWhiteSpace(slugs[0]) ||
            string.IsNullOrWhiteSpace(slugs[1]) || string.Equals(slugs[0], slugs[1], StringComparison.Ordinal))
            return Problem(statusCode: StatusCodes.Status400BadRequest,
                title: "Exactly two distinct talent slugs are required.");

        var response = await comparisons.CompareAsync(CurrentUserId, slugs[0], slugs[1], cancellationToken);
        return response is null
            ? Problem(statusCode: StatusCodes.Status404NotFound, title: "Resource not found.")
            : Ok(response);
    }

    [HttpGet("dashboard")]
    public async Task<ActionResult<RecruiterDashboardResponse>> Dashboard(CancellationToken cancellationToken) =>
        Ok(await dashboard.GetAsync(CurrentUserId, cancellationToken));
}
