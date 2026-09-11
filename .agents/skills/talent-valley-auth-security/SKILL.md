---
name: talent-valley-auth-security
description: Use for Talent Valley authentication, authorization, ASP.NET Core Identity, JWT cookies, CSRF, account activation/reset, role policies, ownership checks, CORS, protected documents, or security-sensitive changes.
---

# Talent Valley Auth and Security

Security requirements are non-negotiable unless explicitly changed by the project owner.

Read `references/security-rules.md` before implementing auth or authorization.

## Required approach

1. Use ASP.NET Core Identity for users, password hashing, reset and activation tokens.
2. Use JWT in an HttpOnly cookie.
3. Never store JWT in browser localStorage/sessionStorage.
4. Protected endpoints must validate both role and current account state.
5. `/me` ownership comes from authenticated identity, not request IDs.
6. Use antiforgery/CSRF protection for state-changing cookie-authenticated requests.
7. Keep protected files behind authorized API endpoints.
8. Never log passwords, JWTs, or auth cookies.
9. Keep secrets outside committed configuration.
10. Use generic auth failure messages where account enumeration is a risk.
