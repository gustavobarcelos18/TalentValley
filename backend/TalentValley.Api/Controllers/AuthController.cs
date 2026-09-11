using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TalentValley.Api.Authorization;
using TalentValley.Api.DTOs;
using TalentValley.Api.Services;

namespace TalentValley.Api.Controllers;

[ApiController]
[Route("api/auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuthController(AuthService auth, AccountTokenService accountTokens, IHostEnvironment environment) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("csrf")]
    public ActionResult<CsrfResponse> Csrf([FromServices] IAntiforgery antiforgery) =>
        new CsrfResponse(antiforgery.GetAndStoreTokens(HttpContext).RequestToken!);

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var result = await auth.LoginAsync(request);
        if (result.Status != StatusCodes.Status200OK)
            return Problem(statusCode: result.Status, title: result.Status switch
            {
                StatusCodes.Status423Locked => "Sign-in is temporarily locked. Try again later.",
                StatusCodes.Status403Forbidden => "Account access is unavailable.",
                _ => "Invalid email or password."
            });

        Response.Cookies.Append(AuthCookie.Name, result.Token!, AuthCookie.Options(environment, result.Expires));
        return Ok(result.Response);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UsuarioAutenticadoResponse>> Me()
    {
        var user = await auth.GetUserAsync(Guid.Parse(User.FindFirst("sub")!.Value));
        return user is null ? Problem(statusCode: StatusCodes.Status403Forbidden, title: "Account access is unavailable.") : Ok(user);
    }

    // Even expired or blocked sessions can clear their cookie; antiforgery still applies.
    [AllowAnonymous]
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete(AuthCookie.Name, AuthCookie.Options(environment));
        return NoContent();
    }

    [AllowAnonymous]
    [HttpPost("activate-account")]
    public async Task<IActionResult> Activate(ActivateAccountRequest request) =>
        await accountTokens.ActivateAsync(request.Email, request.Token, request.Senha)
            ? NoContent() : InvalidAccountToken();

    [AllowAnonymous]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> Forgot(ForgotPasswordRequest request)
    {
        await accountTokens.ForgotPasswordAsync(request.Email);
        return Accepted(new { mensagem = "If the account is eligible, password reset instructions will be sent." });
    }

    [AllowAnonymous]
    [HttpPost("reset-password")]
    public async Task<IActionResult> Reset(ResetPasswordRequest request) =>
        await accountTokens.ResetPasswordAsync(request.Email, request.Token, request.NovaSenha)
            ? NoContent() : InvalidAccountToken();

    private ObjectResult InvalidAccountToken() => Problem(statusCode: StatusCodes.Status400BadRequest,
        title: "Unable to complete this request. Check the link and password requirements.");
}
