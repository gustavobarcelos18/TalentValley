using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TalentValley.Api.Domain.Entities;

namespace TalentValley.Api.Authorization;

// The administrator behind a demonstration session; the stamp is raw here and only its hash goes into the token.
public sealed record DemoAdmin(Guid Id, string SecurityStamp);

public sealed class JwtTokenService(IOptions<JwtOptions> options)
{
    public const string SecurityStampClaim = "security_stamp";

    // Present only in a demonstration session: the administrator who switched into the demo account, and a hash of
    // that administrator's security stamp so the way back closes when the administrator's credentials are reset.
    public const string DemoAdminClaim = "demo_admin";
    public const string DemoAdminStampClaim = "demo_admin_stamp";

    public (string Token, DateTimeOffset Expires) Create(ApplicationUser user, string role, string securityStamp,
        DemoAdmin? demoAdmin = null, DateTimeOffset? expiresAt = null)
    {
        var settings = options.Value;
        var now = DateTimeOffset.UtcNow;
        // Switching in and out of a demonstration account keeps the original expiry: it must not renew the session.
        var expires = expiresAt ?? now.AddHours(settings.ExpirationHours);
        List<Claim> claims = [new("sub", user.Id.ToString()), new("role", role), new("name", user.NomeCompleto),
            new(SecurityStampClaim, HashSecurityStamp(securityStamp))];
        if (demoAdmin is not null)
        {
            claims.Add(new(DemoAdminClaim, demoAdmin.Id.ToString()));
            claims.Add(new(DemoAdminStampClaim, HashSecurityStamp(demoAdmin.SecurityStamp)));
        }
        var token = new JwtSecurityToken(
            issuer: settings.Issuer, audience: settings.Audience, claims: claims,
            notBefore: now.UtcDateTime, expires: expires.UtcDateTime,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Convert.FromBase64String(settings.SigningKey)), SecurityAlgorithms.HmacSha256));
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    // JWTs are signed, not encrypted: carry only a hash so the raw Identity stamp never leaves the server.
    public static string HashSecurityStamp(string securityStamp) =>
        Base64UrlEncoder.Encode(SHA256.HashData(Encoding.UTF8.GetBytes(securityStamp)));
}
