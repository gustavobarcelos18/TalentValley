# Security Rules

## Authentication

- ASP.NET Core Identity
- JWT
- cookie name may be `tv_access`
- HttpOnly
- Secure in production
- SameSite=Lax unless deployment requirements justify another setting
- suggested JWT lifetime: 8 hours
- no refresh token in MVP

Claims should remain small:
- `sub`
- `role`
- `name`

Do not encode profile/business state into JWT.

## Authorization

Policies/concepts:
- `RequireAdmin`
- `RequireActiveStudent`
- `RequireActiveRecruiter`
- student ownership

Blocked status must be checked against current DB state even if an existing JWT is still cryptographically valid.

Student blocked:
- cannot login/use existing session;
- disappears from recruiter discovery.

Recruiter blocked:
- immediately loses protected recruiter access.

## CSRF

Cookie auth means state-changing operations require CSRF protection.

Use ASP.NET Core antiforgery with an `X-XSRF-TOKEN`-style header or the existing repository convention.

GET/HEAD/OPTIONS must not mutate state.

## CORS

During local development, allow only the known frontend origin with credentials.
Never use `AllowAnyOrigin()` together with credentials.

Prefer same-origin production deployment:
- `/` → Next.js
- `/api` → ASP.NET Core

## Account lifecycle

Admin creates student/recruiter access.

Admin never chooses or sees the user's password.

Activation:
- Identity token;
- link to frontend;
- user defines own password.

Forgot/reset password uses Identity secure token flow.

Suggested password baseline:
- minimum 8;
- upper;
- lower;
- number.

Suggested lockout:
- 5 invalid attempts;
- 15 minutes.

## Files

Photos, CVs and certificates are private project data.

Store storage keys, not public permanent URLs or BLOB bytes.

Validate:
- maximum size;
- extension;
- claimed content type;
- basic file signature/magic bytes.

Photo:
- JPEG/PNG/WEBP;
- max 5 MB.

CV/certificate:
- PDF;
- max 10 MB.

Never place CVs/certificates in publicly served `wwwroot`.
