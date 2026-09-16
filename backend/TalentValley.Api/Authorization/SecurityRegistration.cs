using System.Security.Claims;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TalentValley.Api.Data;
using TalentValley.Api.Domain.Entities;
using TalentValley.Api.Email;
using TalentValley.Api.Services;

namespace TalentValley.Api.Authorization;

public static class SecurityRegistration
{
    public static void AddApplicationSecurity(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var dataProtection = services.AddDataProtection();
        var keysPath = configuration["DataProtection:KeysPath"]?.Trim();
        if (!string.IsNullOrWhiteSpace(keysPath))
        {
            var fullKeysPath = Path.GetFullPath(keysPath, environment.ContentRootPath);
            Directory.CreateDirectory(fullKeysPath);
            dataProtection.PersistKeysToFileSystem(new DirectoryInfo(fullKeysPath));
        }
        services.AddIdentityCore<ApplicationUser>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.Password.RequiredLength = 8;
            options.Password.RequireUppercase = true;
            options.Password.RequireLowercase = true;
            options.Password.RequireDigit = true;
            options.Password.RequireNonAlphanumeric = false;
            options.Lockout.MaxFailedAccessAttempts = 5;
            options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
            options.Lockout.AllowedForNewUsers = true;
            options.SignIn.RequireConfirmedEmail = true;
        }).AddRoles<IdentityRole<Guid>>()
            .AddSignInManager()
            .AddEntityFrameworkStores<AppDbContext>()
            .AddDefaultTokenProviders();

        services.AddOptions<JwtOptions>().Bind(configuration.GetSection("Jwt"))
            .Validate(JwtOptions.HasSafeSigningKey, "Jwt:SigningKey must be Base64 containing at least 32 random bytes; configure user-secrets or an environment secret.")
            .Validate(o => !string.IsNullOrWhiteSpace(o.Issuer) && !string.IsNullOrWhiteSpace(o.Audience), "Jwt:Issuer and Jwt:Audience are required.")
            .Validate(o => double.IsFinite(o.ExpirationHours) && o.ExpirationHours > 0 && o.ExpirationHours <= 24, "Jwt:ExpirationHours must be greater than 0 and at most 24.")
            .ValidateOnStart();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
            .Configure<IOptions<JwtOptions>>((options, jwt) =>
            {
                options.MapInboundClaims = false;
                options.IncludeErrorDetails = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true, ValidIssuer = jwt.Value.Issuer,
                    ValidateAudience = true, ValidAudience = jwt.Value.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Convert.FromBase64String(jwt.Value.SigningKey)),
                    ValidateLifetime = true, RequireExpirationTime = true, RequireSignedTokens = true,
                    ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
                    ClockSkew = TimeSpan.FromSeconds(30), NameClaimType = "name", RoleClaimType = "role"
                };
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        if (context.Request.Cookies.TryGetValue(AuthCookie.Name, out var token) && !string.IsNullOrWhiteSpace(token))
                            context.Token = token;
                        else context.NoResult(); // Do not fall back to Authorization headers.
                        return Task.CompletedTask;
                    },
                    OnTokenValidated = context =>
                    {
                        var subject = context.Principal?.FindFirst("sub")?.Value;
                        if (!Guid.TryParse(subject, out _) || context.Principal?.FindFirst("role") is null)
                            context.Fail("Invalid identity claims.");
                        else
                            // Antiforgery binds tokens to the stable subject, never to a display name.
                            ((ClaimsIdentity)context.Principal!.Identity!).AddClaim(new Claim(ClaimTypes.NameIdentifier, subject));
                        return Task.CompletedTask;
                    }
                };
            });

        services.AddAuthorization(options =>
        {
            var active = new AuthorizationPolicyBuilder().RequireAuthenticatedUser()
                .AddRequirements(new ActiveAccountRequirement()).Build();
            options.DefaultPolicy = active;
            options.FallbackPolicy = active;
            options.AddPolicy(AppPolicies.RequireAdmin, p => p.RequireAuthenticatedUser().AddRequirements(new ActiveAccountRequirement(AppRoles.Admin)));
            options.AddPolicy(AppPolicies.RequireActiveStudent, p => p.RequireAuthenticatedUser().AddRequirements(new ActiveAccountRequirement(AppRoles.Student)));
            options.AddPolicy(AppPolicies.RequireActiveRecruiter, p => p.RequireAuthenticatedUser().AddRequirements(new ActiveAccountRequirement(AppRoles.Recruiter)));
            options.AddPolicy(AppPolicies.RequireActiveStudentOrRecruiter, p => p.RequireAuthenticatedUser()
                .RequireRole(AppRoles.Student, AppRoles.Recruiter).AddRequirements(new ActiveAccountRequirement()));
        });
        services.AddScoped<IAuthorizationHandler, ActiveAccountHandler>();
        services.AddScoped<AccountAccess>();
        services.AddScoped<IdentityBootstrap>();
        services.AddScoped<JwtTokenService>();
        services.AddScoped<AuthService>();
        services.AddScoped<AccountTokenService>();
        services.AddOptions<BrevoOptions>().Bind(configuration.GetSection("Brevo"));
        services.AddHttpClient<BrevoEmailSender>();
        services.AddTransient<IEmailSender>(provider =>
        {
            if (environment.IsDevelopment())
                return new DevelopmentEmailSender(provider.GetRequiredService<ILogger<DevelopmentEmailSender>>());

            var brevo = provider.GetRequiredService<IOptions<BrevoOptions>>().Value;
            return brevo.IsConfigured
                ? provider.GetRequiredService<BrevoEmailSender>()
                : new UnavailableEmailSender(provider.GetRequiredService<ILogger<UnavailableEmailSender>>());
        });

        services.AddOptions<FrontendOptions>().Bind(configuration.GetSection("Frontend"))
            .Validate(o => Uri.TryCreate(o.BaseUrl, UriKind.Absolute, out var uri) &&
                (uri.Scheme == "https" || (environment.IsDevelopment() && uri.Scheme == "http")) &&
                uri.AbsolutePath == "/" && string.IsNullOrEmpty(uri.Query) && string.IsNullOrEmpty(uri.Fragment) && string.IsNullOrEmpty(uri.UserInfo),
                "Frontend:BaseUrl must be a frontend origin (HTTPS outside Development).")
            .ValidateOnStart();
        services.AddAntiforgery(options =>
        {
            options.HeaderName = "X-XSRF-TOKEN";
            options.Cookie.Name = "tv_antiforgery";
            options.Cookie.HttpOnly = true;
            options.Cookie.Path = "/";
            options.Cookie.SameSite = SameSiteMode.Lax;
            options.Cookie.SecurePolicy = environment.IsDevelopment() ? CookieSecurePolicy.SameAsRequest : CookieSecurePolicy.Always;
        });
        services.AddCors(options => options.AddPolicy("Frontend", policy =>
        {
            if (environment.IsDevelopment())
                policy.WithOrigins(configuration["Frontend:BaseUrl"]!.TrimEnd('/'))
                    .WithMethods("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                    .WithHeaders("Content-Type", "X-XSRF-TOKEN").AllowCredentials();
        }));
    }
}
