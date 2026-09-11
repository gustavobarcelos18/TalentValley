using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Authorization;

public sealed class JwtTokenService(IOptions<JwtOptions> options)
{
    public (string Token, DateTimeOffset Expires) Create(ApplicationUser user, string role)
    {
        var settings = options.Value;
        var now = DateTimeOffset.UtcNow;
        var expires = now.AddHours(settings.ExpirationHours);
        var token = new JwtSecurityToken(
            issuer: settings.Issuer, audience: settings.Audience,
            claims: [new Claim("sub", user.Id.ToString()), new Claim("role", role), new Claim("name", user.NomeCompleto)],
            notBefore: now.UtcDateTime, expires: expires.UtcDateTime,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Convert.FromBase64String(settings.SigningKey)), SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
