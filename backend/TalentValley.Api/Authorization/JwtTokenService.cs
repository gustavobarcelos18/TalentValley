using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Authorization;

public sealed class JwtTokenService(IOptions<JwtOptions> options)
{
    public const string SecurityStampClaim = "security_stamp";

    public (string Token, DateTimeOffset Expires) Create(ApplicationUser user, string role, string securityStamp)
    {
        var settings = options.Value;
        var now = DateTimeOffset.UtcNow;
        var expires = now.AddHours(settings.ExpirationHours);
        var token = new JwtSecurityToken(
            issuer: settings.Issuer, audience: settings.Audience,
            claims: [new Claim("sub", user.Id.ToString()), new Claim("role", role), new Claim("name", user.NomeCompleto),
                new Claim(SecurityStampClaim, HashSecurityStamp(securityStamp))],
            notBefore: now.UtcDateTime, expires: expires.UtcDateTime,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Convert.FromBase64String(settings.SigningKey)), SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    // JWTs are signed, not encrypted: carry only a hash so the raw Identity stamp never leaves the server.
    public static string HashSecurityStamp(string securityStamp) =>
        Base64UrlEncoder.Encode(SHA256.HashData(Encoding.UTF8.GetBytes(securityStamp)));
}
