using System.ComponentModel.DataAnnotations;

namespace TalentValley.Api.DTOs;

public sealed record LoginRequest(
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(1024)] string Senha);

public sealed record UsuarioAutenticadoResponse(Guid Id, string Nome, string Email, string Role);
public sealed record LoginResponse(UsuarioAutenticadoResponse Usuario, string DestinoInicial);
public sealed record ForgotPasswordRequest([Required, EmailAddress, StringLength(256)] string Email);
public sealed record ResetPasswordRequest(
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(4096)] string Token,
    [Required, StringLength(1024)] string NovaSenha);
public sealed record ActivateAccountRequest(
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(4096)] string Token,
    [Required, StringLength(1024)] string Senha);

public sealed record CsrfResponse(string Token);
