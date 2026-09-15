# Talent Valley demo deployment

> **DEMO / EVALUATION ONLY.** This guide uses a single Railway instance, logs account links instead of delivering email, and can apply migrations on startup. Before a real production release, add real email delivery and a formal migration/release process.

## Railway backend

1. In Railway, create a project from `gustavobarcelos18/TalentValley`.
2. Set the service **Root Directory** to `backend/TalentValley.Api`. Railway builds the included `Dockerfile`.
3. Add a persistent volume mounted at `/data`.
4. Generate a public Railway domain and set these environment variables:

```text
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=Data Source=/data/talent-valley.db
Storage__RootPath=/data/storage
DataProtection__KeysPath=/data/dataprotection
Deployment__ApplyMigrationsOnStartup=true
Deployment__TrustForwardedHeaders=true
Jwt__Issuer=TalentValley.Api
Jwt__Audience=TalentValley.Frontend
Jwt__SigningKey=<BASE64 SECRET WITH AT LEAST 32 RANDOM BYTES>
Jwt__ExpirationHours=8
Frontend__BaseUrl=https://YOUR-VERCEL-PROJECT.vercel.app
BootstrapAdmin__Enabled=true
BootstrapAdmin__Email=<DEMO ADMIN EMAIL>
BootstrapAdmin__Name=<DEMO ADMIN NAME>
BootstrapAdmin__Password=<DEMO ADMIN PASSWORD>
Demo__LogAccountLinks=true
```

Do not define `PORT`; Railway supplies it. Configure Railway health checking to `/health`.

Generate the signing key locally and copy only its Base64 result into Railway:

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Or, with OpenSSL:

```sh
openssl rand -base64 32
```

The persistent volume holds `/data/talent-valley.db`, its adjacent SQLite WAL files, `/data/storage`, and `/data/dataprotection`. Database schema creation/upgrades occur only because `Deployment__ApplyMigrationsOnStartup=true` is explicitly set. Uploaded files remain private and are served through protected API endpoints.

## Vercel frontend

1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `frontend` and select **Next.js**.
3. Add this server-side environment variable:

```text
BACKEND_API_URL=https://YOUR-RAILWAY-SERVICE.up.railway.app
```

4. Do **not** configure `NEXT_PUBLIC_API_BASE_URL` in Vercel.
5. Deploy.

The browser calls its own `/api/*` origin. Next.js rewrites those requests to Railway, so the HttpOnly auth cookie and CSRF behavior remain same-origin. Do not use a trailing path in either deployment URL.

## First deployment sequence

1. Deploy Railway first with a temporary valid HTTPS `Frontend__BaseUrl` if the final Vercel URL is not known yet.
2. Copy the generated Railway domain into Vercel as `BACKEND_API_URL` and deploy Vercel.
3. Copy the resulting exact Vercel HTTPS origin into Railway as `Frontend__BaseUrl`.
4. Restart/redeploy Railway. Redeploy Vercel only if the Railway domain changed.

The final values must be the exact Vercel origin for `Frontend__BaseUrl` and the exact Railway origin for `BACKEND_API_URL`.

## First demo login

With the Railway settings above, startup applies migrations, configures SQLite, creates roles, seeds competency/language catalogs idempotently, and creates the configured admin when valid credentials are supplied. Open the Vercel URL and sign in with that admin account. Use the app to create student and recruiter accounts.

When activation or reset email is requested, retrieve its link from Railway logs while `Demo__LogAccountLinks=true`, then open that link through the Vercel frontend. These links are deliberately logged only for this demo mode; do not use it for real production email. Once the bootstrap account exists, `BootstrapAdmin__Enabled` can be turned off without affecting it. Leave demo link logging enabled only while activation/reset links are needed.
