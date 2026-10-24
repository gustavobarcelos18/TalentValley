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
- `security_stamp` (hashed Identity stamp; changes on password reset, forcing re-login)

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

## Demonstration mode (admin views as a demo account)

Off unless `Demo:Enabled=true`; when off, `preparar`, `restaurar` and `entrar` answer 404, `estado` still answers (`habilitado: false`) and `voltar` keeps working for an open session.

- Demo accounts (`EhDemo = true`) have no password and an `@demo.invalid` email. They never sign in through the login form (same 401 as an unknown account), and password change, password reset, activation, resend and self-deletion are blocked for them.
- Only a signed-in real ADMIN may switch (`POST /api/admin/demo/entrar`). The server loads the demo account of the requested role from the database; an id from the browser is never used. It issues a new `tv_access` cookie whose `role` is the demo account's role (ALUNO or RECRUTADOR), so admin endpoints are not reachable from a demo session.
- Two extra claims, signed with the rest of the token: `demo_admin` (id of the original admin) and `demo_admin_stamp` (hash of that admin's security stamp). They exist only in demo sessions.
- `OnTokenValidated` requires `EhDemo == token has demo_admin`, and on every request of a demo session re-checks in the database that the admin still exists, is still ADMIN and the stamp matches.
- `POST /api/demo/voltar` re-checks the same and issues a new ADMIN cookie. Any failure answers 403.
- The demo session **inherits the original expiry** of the admin's token: switching in and out never renews the session time (8 hours by default).
- After every switch the antiforgery pair must be fetched again (the cookie changed), as after login.
- Audit: `DEMO_ENTROU`, `DEMO_VOLTOU` (visible), `DEMO_PREPARADA`, `DEMO_RESTAURADA` (hidden from the audit screen).
- Restoring recreates the demo accounts with new ids, which ends open demo sessions (401).

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
