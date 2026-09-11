namespace TalentValley.Api.Authorization;

public static class AuthCookie
{
    public const string Name = "tv_access";

    public static CookieOptions Options(IHostEnvironment environment, DateTimeOffset? expires = null) => new()
    {
        HttpOnly = true,
        Secure = !environment.IsDevelopment(),
        SameSite = SameSiteMode.Lax,
        Path = "/",
        Expires = expires,
        IsEssential = true
    };
}
