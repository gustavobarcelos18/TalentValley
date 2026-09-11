# Talent Valley

Talent Valley is the career platform for Rio Pomba Valley. It will maintain trusted student profiles and help authorized recruiters discover talent through structured search.

## Stack

- Frontend: Next.js, React, TypeScript, MUI / Material UI, Material Icons, Tailwind CSS, Framer Motion, and GSAP.
- Backend: ASP.NET Core Web API, ASP.NET Core Identity support, JWT bearer support, Entity Framework Core, and SQLite.

## Repository structure

```text
talent-valley/
|-- .agents/                  Repository skills
|-- frontend/                 Next.js application
`-- backend/
    |-- TalentValley.Api/     ASP.NET Core Web API
    |-- TalentValley.Api.Tests/ Identity/security integration tests
    `-- TalentValley.slnx     Backend solution
```

## Prerequisites

- Node.js 20.9 or newer
- npm
- .NET 10 SDK

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Run the backend

```bash
cd backend/TalentValley.Api
dotnet restore
# Configure secrets and apply the migration below before first startup.
dotnet run --launch-profile https
```

In Development, the OpenAPI document is available at `https://localhost:7102/openapi/v1.json`.

For browser requests from `http://localhost:3000`, run the API with `--launch-profile http` at `http://localhost:5087` so both use the same scheme with SameSite=Lax cookies. The HTTPS profile remains available for API tools or an HTTPS frontend (configure its origin accordingly). HTTPS redirection remains enabled; the HTTP-only Development profile has no HTTPS endpoint to redirect to.

## Current phase

Phase 9: recruiter favorites, neutral comparison, and recruiter dashboard completed. Phase 0–8 behavior remains intact.

Active recruiters can add and remove favorites idempotently at `POST/DELETE /api/recrutador/favoritos/{slug}` and list their visible favorites, 10 per page, at `GET /api/recrutador/favoritos?page=1`. Existing favorites of blocked students remain stored but hidden and reappear with their original timestamp after reactivation. Talent search and detail responses now include a recruiter-specific `favorito` flag without affecting search ranking or order.

`GET /api/recrutador/comparar?slugs=a&slugs=b` requires exactly two distinct active talents, preserves request order, and returns both complete professional profiles plus deterministic intersections of general competencies, availability, and modalities. It is factual only: no winner, score, recommendation, persistence, or project-only competency intersection.

`GET /api/recrutador/dashboard` returns only profiles updated since the previous login, new active student accounts since that boundary, the current recruiter's visible favorite count, and up to five recent visible favorites. The boundary is `LoginAnteriorEm`; dashboard reads it without mutation. On first login the boundary is null and both since-last-access counters are zero.

Active recruiters can search active students with `GET /api/talentos`, open a complete professional profile at `GET /api/talentos/{slug}`, and read its protected photo, curriculum, and formation certificates through the corresponding `/api/talentos/{slug}/...` routes. Inactive students are hidden as 404 from every slug/file route, and current database state immediately blocks an inactive recruiter even when its existing JWT is still valid.

The search page size is fixed at 10. Supported query groups are `nome`, `cidade`, `uf`, repeated `competenciaIds`, repeated `tiposFormacao`, `formacaoNome`, repeated `statusFormacao`, `rpvVerificado=true`, repeated `disponibilidades`, and repeated `modalidades`. Repeated values use normal ASP.NET Core query-array binding, for example `?competenciaIds=1&competenciaIds=4`; values within a group are OR, while different groups are AND. All supplied education criteria must match the same formation. City matching is trimmed, exact, and SQLite `NOCASE` case-insensitive; name and formation name use normalized substring matching.

Sort modes are `relevancia`, `recentes`, and `nome`. The default is relevance when a real filter is active and recent otherwise. Relevance awards each requested general competency 2 points, each requested project-only competency 1 point, never double-counts the same competency, and awards 1 point per other active filter group. Relevance ties use profile update descending, normalized name, then student ID; recent and name sorting use their documented deterministic name/ID tie-breakers. `rpvVerificado=false` is accepted as no RPV filter; only `true` activates the verified-RPV condition.

Admins have a paginated pending queue at `GET /api/admin/validacoes-rpv`, formation detail and protected certificate access, plus commands to approve, reject, or remove a verification. The state machine is `PENDENTE -> VERIFICADO`, `PENDENTE -> REJEITADO`, and `VERIFICADO -> PENDENTE`; invalid transitions return conflict. Approval requires the referenced physical certificate. Every real transition and its audit entry commit atomically, competing admin actions cannot both succeed, and administrative validation changes only `StatusValidacaoRpv`/`ValidadoEm`—it does not change `Aluno.AtualizadoEm` or `Formacao.AtualizadoEm`.

Uploaded files are private and are delivered only through active-student authorized API endpoints. Photos accept validated JPEG, PNG, or WebP files up to 5 MB; curricula and certificates accept validated PDFs up to 10 MB. Validation checks size, extension, declared MIME type, and file signature. Curriculum and certificate responses consistently download with safe filenames (`curriculo.pdf` and `certificado.pdf`); photos are inline. Files are never exposed through static-file middleware, and storage keys and physical paths never appear in API responses.

`IFileStorage` keeps application workflows independent of the initial `LocalFileStorage` provider. By default, Development resolves `Storage:RootPath=storage` beneath the API content root and uses the controlled `fotos`, `curriculos`, and `certificados` subdirectories. Deployments must configure `Storage:RootPath` to a persistent mounted volume; container-local ephemeral storage will lose uploads. Uploaded contents are ignored by Git.

Replacement writes a new opaque GUID key, commits the database reference, and only then removes the old file. Deletes clear the database reference first. Changing an RPV formation certificate resets its validation to `PENDENTE` and clears `ValidadoEm`; non-RPV formations keep a null validation state. Successful student deletion cleans all associated physical files after its database/Identity transaction commits.

New student self-service endpoints (all require the active-student policy; student ID is always derived from the authenticated JWT `sub`):

- `GET /api/alunos/me` returns the complete profile aggregate, including full formation, experience, and project DTOs with project technologies; `fotoUrl` is `/api/alunos/me/foto` only when a photo exists; storage keys are never exposed.
- `PUT /api/alunos/me/dados-basicos` updates name/city/UF, refreshes `NomeBusca` on name change, keeps the slug stable, and returns 204.
- `PUT /api/alunos/me/sobre` updates the bio (trimmed; blank becomes null; max 1500 chars) and returns 204.
- `PUT /api/alunos/me/contato` updates phone/professional email/URLs (http/https only; 204).
- `PUT /api/alunos/me/competencias` full-replaces the student's competencies by catalog ID (unknown IDs → 400).
- `PUT /api/alunos/me/idiomas` full-replaces languages with string enum levels (BASICO–NATIVO; unknown IDs/duplicates → 400).
- `PUT /api/alunos/me/disponibilidade` full-replaces availability and work modalities (string enums; unknown values → 400).

Catalog endpoints: `GET /api/competencias?search=rea` and `GET /api/idiomas` return controlled, alphabetically ordered catalogs (filtering runs in SQL). Catalogs are seeded idempotently at startup with normalized `NomeBusca`; they never expose IDs to hardcode and never duplicate existing rows. Meaningful mutations set `Aluno.AtualizadoEm`; idempotent requests do not.

Phase 5 endpoints (same active-student policy, JWT `sub` ownership, and CSRF protection):

- `GET/POST /api/alunos/me/formacoes`, `PUT/DELETE /api/alunos/me/formacoes/{id}`.
- `GET/POST /api/alunos/me/experiencias`, `PUT/DELETE /api/alunos/me/experiencias/{id}`.
- `GET/POST /api/alunos/me/projetos`, `PUT/DELETE /api/alunos/me/projetos/{id}`.
- `GET /api/alunos/me/trajetoria` combines formations and experiences, excluding projects. Ordering is current/ongoing first, start date descending, item kind (FORMACAO before EXPERIENCIA), then ID ascending. Formation status `EM_ANDAMENTO` and experience `Atual` determine current items.

Creates return 201 with a DTO, updates 200 with a DTO, and deletes 204. Unknown or not-owned IDs return the same 404. Invalid input returns a problem 400. Student requests cannot set owner IDs, validation state, or storage keys. Calendar dates use `DateOnly`; completed formations require an end date. Current experiences/projects clear the end date. Real changes update resource and student timestamps; normalized no-op PUTs preserve both.

At most one formation is principal; selecting a new principal atomically unsets the previous one. Unsetting/deleting the principal allows zero, without promotion. RPV formations start `PENDENTE`; relevant student edits reset verified/rejected validation to `PENDENTE` and clear `ValidadoEm`. Principal-only changes retain validation. Non-RPV formations use `StatusValidacaoRpv = null` (validation does not apply), including when RPV is turned off. Responses expose only `possuiCertificado`, never its storage key. The new `FormationOptionalWorkload` migration makes `CargaHoraria` nullable; provided values must be positive.

Projects are limited to two (third create returns 409), with unique orders 1/2. Creating into an occupied order moves the existing project to the free order; updating into an occupied order swaps both projects transactionally. Because SQLite enforces both unique order and the 1/2 check immediately, a swap removes/reinserts the other project and its technologies inside the transaction, preserving IDs, creation timestamps, and content. Deletion compacts the survivor to order 1. Write transactions serialize count/order decisions. Technologies fully replace catalog references, reject unknown/duplicate IDs, and never change general student competencies.

Recruiter frontend screens and the admin dashboard remain future phases.

## Authentication configuration

Run from the repository root in PowerShell. Generate a random signing key locally; never commit it:

```powershell
$jwtBytes = New-Object byte[] 32
$jwtRandom = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$jwtRandom.GetBytes($jwtBytes)
$jwtRandom.Dispose()
$jwtKey = [Convert]::ToBase64String($jwtBytes)
dotnet user-secrets set 'Jwt:SigningKey' $jwtKey --project backend/TalentValley.Api
Remove-Variable jwtKey, jwtBytes, jwtRandom
```

`Jwt:SigningKey` must be Base64 encoding at least 32 cryptographically random bytes. Missing, short, or repetitive keys fail startup in every environment. Development configuration supplies `Jwt:Issuer=TalentValley.Api`, `Jwt:Audience=TalentValley.Frontend`, `Jwt:ExpirationHours=8`, and `Frontend:BaseUrl=http://localhost:3000`. Lifetime must be greater than 0 and at most 24 hours. Outside Development, supply the issuer, audience, signing key, frontend HTTPS origin, and connection string through deployment configuration/secrets. CORS only permits the configured Development origin with credentials; Production uses same-origin routing.

Identity requires a unique email and passwords with at least 8 characters, uppercase, lowercase, and a digit; symbols are optional. Five failed password attempts lock sign-in for 15 minutes. Accounts require activation/email confirmation before sign-in. Successful login shifts `UltimoLoginEm` into `LoginAnteriorEm` and records the current UTC time.

JWTs use HS256, validated issuer/audience/signature/lifetime, and 30 seconds of clock skew. Identity claims are only `sub`, `role`, and `name`, alongside standard issuer/audience/lifetime metadata. JWTs are read exclusively from `tv_access`: HttpOnly, SameSite=Lax, Path=/, Secure outside Development, with expiration matching the JWT. They are never returned in JSON. Logout deletes the browser cookie; this MVP has no refresh tokens or JWT revocation list.

`RequireAdmin`, `RequireActiveStudent`, and `RequireActiveRecruiter` verify current role membership. Student/recruiter policies also read `Aluno.Ativo` / `Recrutador.Status=ATIVO` from the database on each protected request. The default and fallback policies apply the same current-account check. Blocking an account or removing its role invalidates protected access immediately, including `/api/auth/me`.

### Optional Development admin

Configure all three settings to enable bootstrap. Choose a local password satisfying the policy; this example prompts for it instead of putting a credential in the command history:

```powershell
dotnet user-secrets set 'BootstrapAdmin:Email' 'admin@example.test' --project backend/TalentValley.Api
dotnet user-secrets set 'BootstrapAdmin:Name' 'Local Administrator' --project backend/TalentValley.Api
$bootstrapPassword = Read-Host 'Local admin password' -AsSecureString
$bootstrapCredential = New-Object System.Net.NetworkCredential('', $bootstrapPassword)
dotnet user-secrets set 'BootstrapAdmin:Password' $bootstrapCredential.Password --project backend/TalentValley.Api
Remove-Variable bootstrapPassword, bootstrapCredential
```

Missing/incomplete settings log an informational skip and startup continues (a valid JWT key and migrated DB are still required). Bootstrap runs only in Development, is idempotent, normalizes `NomeBusca`, and never resets an existing admin password or promotes an existing non-admin. No student/recruiter/demo accounts are seeded. Remove the bootstrap password secret after the initial account is created if bootstrap is no longer needed.

### API and antiforgery request flow

1. Fetch `GET /api/auth/csrf` with `credentials: 'include'`. It returns `{ "token": "..." }` for JavaScript and sets a separate HttpOnly antiforgery cookie. Keep the request token in memory.
2. Send that token in `X-XSRF-TOKEN`, with credentials, on all POST/PUT/PATCH/DELETE API requests, including login, logout, activation, forgot-password, and reset-password. Missing/invalid antiforgery returns a generic 400 problem response. GET/HEAD/OPTIONS do not require a request token.
3. Login with `{ "email": "...", "senha": "..." }` at `POST /api/auth/login`. The response has `usuario` and `destinoInicial`: `/meu-perfil`, `/recrutador`, or `/admin`. Login errors are 400 validation, generic 401 credentials, 403 blocked access, or 423 lockout.
4. Fetch a new CSRF token after login and after logout because antiforgery tokens are bound to the current identity. Use `GET /api/auth/me` for `{ id, nome, email, role }` and `POST /api/auth/logout` to clear the session (204). Blocked or expired sessions can still obtain a CSRF token and log out.

`POST /api/auth/activate-account` accepts `{ email, token, senha }`; `POST /api/auth/forgot-password` accepts `{ email }`; `POST /api/auth/reset-password` accepts `{ email, token, novaSenha }`. Activation/reset return 204 or a generic 400 and do not log in. Forgot-password returns the same generic 202 for eligible, missing, or unactivated accounts. Malformed requests still receive standard validation problems.

`AccountTokenService` generates activation tokens/links for an existing admin-created user and can send them through `IEmailSender`; no admin creation endpoint exists yet. Links target `${Frontend:BaseUrl}/ativar-conta` and `/redefinir-senha` with URL-encoded `email` and `token`. Activation tokens use a dedicated Identity purpose; reset uses Identity password-reset tokens. Both use Identity's default Data Protection token lifetime (one day) and are invalidated after successful use. Activation sets the first password and confirms email atomically. Unactivated accounts cannot use reset as an activation shortcut.

The Development sender logs the destination email and full activation/reset URL in the API console; no external provider is needed. It never logs passwords or JWTs. Outside Development, the placeholder sender logs an explicit error and throws on attempted delivery. Forgot-password handles that known delivery error after logging it and preserves its generic 202 to prevent enumeration; it does not claim delivery succeeded. A production email implementation and persistent Data Protection keys must be configured for deployment.

## Backend checks

```powershell
dotnet restore backend/TalentValley.slnx
dotnet build backend/TalentValley.slnx --no-restore
dotnet test backend/TalentValley.slnx --no-build
dotnet ef migrations has-pending-model-changes --project backend/TalentValley.Api
git diff --check
```

Tests run the actual Identity/JWT/antiforgery pipeline with a separate temporary SQLite database per test, apply migrations explicitly during test setup, and clean up afterward. They never use the developer database. Test-only policy probe endpoints are loaded solely by the test host.

## Database migrations

Run from the repository root (PowerShell):

```powershell
dotnet tool restore
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet ef database update --project backend/TalentValley.Api
dotnet ef migrations has-pending-model-changes --project backend/TalentValley.Api
```

For a future schema change, create a new migration before applying it:

```powershell
dotnet ef migrations add <MigrationName> --project backend/TalentValley.Api --output-dir Data/Migrations
```

The local EF tool is pinned to 10.0.12. Development uses `backend/TalentValley.Api/Database/talent-valley.dev.db`; relative database paths resolve against the API content root, and the parent directory is created automatically. Database files are ignored by Git. Other environments must supply `ConnectionStrings:DefaultConnection`.

`Foreign Keys=True` makes Microsoft.Data.Sqlite enable foreign keys on each connection open. An EF connection interceptor sets `synchronous=NORMAL` for both synchronous and asynchronous opens, including pooled connections. Startup checks the persistent journal mode and enables WAL only if needed. Pooling stays enabled; startup never applies migrations.

Profile/account deletion requires explicit profile removal before deleting its Identity user. Owned profile and favorite rows cascade; catalog references restrict deletion. Audits retain target identifiers as snapshots and set `AdminUserId` to null if the admin is deleted.
