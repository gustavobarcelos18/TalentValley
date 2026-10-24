# Talent Valley demo deployment

> **DEMO / EVALUATION ONLY.** This guide uses a single Render instance (Free plan), a Neon PostgreSQL database (Free plan) and a Cloudflare R2 bucket, and can apply migrations on startup. Before a real production release, add a formal migration/release process and review the accepted deviations listed below. Account activation and password reset require working email delivery (Brevo) in production.

Architecture: **Vercel** (frontend) → **Render** (API, Docker) → **Neon** (PostgreSQL) and **Cloudflare R2** (private files). The API keeps no state on its own disk: the database holds the data and the ASP.NET Core DataProtection keys, and R2 holds the uploaded files.

## Accepted deviations (demo only)

- **DataProtection keys are stored unencrypted in the database.** The database is private (verified TLS plus a secret credential), but there is no KMS or certificate protecting the keys. Review before a real production release.
- **A single database role applies migrations and serves the app.** This is required by `Deployment__ApplyMigrationsOnStartup=true`. Use separate roles (migrations × runtime) before a real production release.

## Neon database

1. In Neon, create one project (Free plan) in AWS `us-east-2` (same region family as Render Ohio) with a database named `talent_valley`.
2. Use the **direct** connection endpoint (host **without** `-pooler`). EF Core migrations use a session-level advisory lock that does not work through a transaction-mode pooler.
3. Build the connection string from the Neon values and keep it secret:

```text
Host=<NEON-DIRECT-HOST>;Database=talent_valley;Username=<ROLE>;Password=<PASSWORD>;SSL Mode=VerifyFull;Maximum Pool Size=10;Connection Idle Lifetime=30;Timeout=30;Command Timeout=30
```

- `SSL Mode=VerifyFull` is mandatory. Never use `Trust Server Certificate=true`. If verification fails inside the container image, install the correct CA in the image instead.
- `Connection Idle Lifetime=30` drops idle connections before Neon suspends the compute (after 5 minutes without use); the first query after a suspension takes about half a second.
- Rehearsal: create a child branch named `rehearsal` and use its direct connection string while testing. Production uses the `main` branch of the Neon project.

## Cloudflare R2 bucket

1. In Cloudflare, create a **private** bucket (for example `talent-valley-files`). Do not attach a custom domain and do not enable the public `r2.dev` URL: files are served only through the protected API endpoints.
2. Create an API token restricted to that bucket with **Object Read & Write** permission and copy the Access Key ID and Secret Access Key.
3. For rehearsals, create a second bucket (for example `talent-valley-files-rehearsal`) with its own token, so tests never touch production files.
4. The account ID shown in the R2 overview page is used to build the endpoint `https://<ACCOUNT-ID>.r2.cloudflarestorage.com`.

## Render backend

1. In Render, create a **Web Service** from `gustavobarcelos18/TalentValley`.
2. Runtime **Docker**, plan **Free**, region **Ohio**, **Root Directory** `backend/TalentValley.Api`, **Health Check Path** `/health`. Render builds the included `Dockerfile`.
3. For a rehearsal, point the service at the branch under test; for production, at `main`.
4. Set these environment variables. Mark every value containing `<SECRET>` as a secret:

```text
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=<SECRET: NEON CONNECTION STRING>
Storage__Provider=R2
Storage__R2__AccountId=<CLOUDFLARE ACCOUNT ID>
Storage__R2__BucketName=<BUCKET NAME>
Storage__R2__AccessKeyId=<SECRET: R2 ACCESS KEY ID>
Storage__R2__SecretAccessKey=<SECRET: R2 SECRET ACCESS KEY>
Deployment__ApplyMigrationsOnStartup=true
Deployment__ForwardedHeaders__Enabled=false
Jwt__Issuer=TalentValley.Api
Jwt__Audience=TalentValley.Frontend
Jwt__SigningKey=<SECRET: BASE64 WITH AT LEAST 32 RANDOM BYTES>
Jwt__ExpirationHours=8
Frontend__BaseUrl=https://YOUR-VERCEL-PROJECT.vercel.app
AllowedHosts=<RENDER-DOMAIN, e.g. your-service.onrender.com>
BootstrapAdmin__Enabled=true
BootstrapAdmin__Email=<DEMO ADMIN EMAIL>
BootstrapAdmin__Name=<DEMO ADMIN NAME>
BootstrapAdmin__Password=<SECRET: DEMO ADMIN PASSWORD>
Brevo__ApiKey=<SECRET: BREVO API KEY>
Brevo__SenderAddress=<VERIFIED SENDER EMAIL>
Brevo__SenderName=<SENDER DISPLAY NAME>
```

Do not define `PORT`; Render supplies it and the `Dockerfile` already uses it. Do not define `Storage__RootPath` or `DataProtection__KeysPath`: outside Development the API requires `Storage__Provider=R2` and refuses to start otherwise, and DataProtection keys go to the database whenever no keys path is set.

Forwarded headers (used for the per-IP rate limit) stay disabled until the trusted proxy ranges are known. Behind Render's proxy the per-IP rate limit may group all users under the proxy address. To enable them, set `Deployment__ForwardedHeaders__Enabled=true`, `Deployment__ForwardedHeaders__IpRanges=<comma-separated CIDRs of the proxies that connect to the API>` and `Deployment__ForwardedHeaders__ForwardLimit=<number of trusted hops>`. Startup fails if `Enabled=true` with no valid range, and if the removed `Deployment__TrustForwardedHeaders` variable is still set.

Generate the signing key locally and copy only its Base64 result into Render:

```powershell
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

Or, with OpenSSL:

```sh
openssl rand -base64 32
```

When migrating from the previous Railway deployment, reuse the **current** `Jwt__SigningKey` so existing sessions stay valid.

Database schema creation/upgrades occur only because `Deployment__ApplyMigrationsOnStartup=true` is explicitly set. Uploaded files remain private in R2 and are served through protected API endpoints.

### Free plan behavior

- Render Free has no persistent disk and sleeps after 15 minutes without traffic. The first request after sleeping takes about one minute.
- Register a free uptime monitor (for example UptimeRobot) calling `GET https://<RENDER-DOMAIN>/health` every 5–10 minutes. `/health` does not touch the database, so Neon can still suspend on its own.
- Neon Free allows 0.5 GB of storage and 100 compute-hours per month. Watch the consumption in the Neon dashboard during the first weeks.

## Vercel frontend

1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `frontend` and select **Next.js**.
3. Add this server-side environment variable:

```text
BACKEND_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

4. Do **not** configure `NEXT_PUBLIC_API_BASE_URL` in Vercel.
5. Deploy.

The browser calls its own `/api/*` origin. Next.js rewrites those requests to Render, so the HttpOnly auth cookie and CSRF behavior remain same-origin. Do not use a trailing path in either deployment URL.

## First deployment sequence

1. Deploy Render first with a temporary valid HTTPS `Frontend__BaseUrl` if the final Vercel URL is not known yet.
2. Copy the generated Render domain into Vercel as `BACKEND_API_URL` and deploy Vercel.
3. Copy the resulting exact Vercel HTTPS origin into Render as `Frontend__BaseUrl`.
4. Restart/redeploy Render. Redeploy Vercel only if the Render domain changed.

The final values must be the exact Vercel origin for `Frontend__BaseUrl` and the exact Render origin for `BACKEND_API_URL`.

## First demo login

With the Render settings above, startup applies migrations, creates roles, seeds competency/language catalogs idempotently, and creates the configured admin when valid credentials are supplied. Open the Vercel URL and sign in with that admin account. Use the app to create student and recruiter accounts.

Email behavior depends on the environment:

- In Development the API uses `DevelopmentEmailSender`, which logs the activation/reset link to the API console instead of delivering email.
- In Production the API uses `BrevoEmailSender` only when `Brevo__ApiKey`, `Brevo__SenderAddress`, and `Brevo__SenderName` are all configured; otherwise it falls back to `UnavailableEmailSender`, which logs an error and does not deliver.

Account activation and password reset require working email delivery in production. When Brevo is not fully configured, those emails are not sent. The account still persists, and the admin UI reports the delivery failure and offers "Reenviar ativação". Once the bootstrap account exists, `BootstrapAdmin__Enabled` can be turned off without affecting it.

## Demonstration mode (admin views as student or recruiter)

Meant for presentations (for example to investors): the admin switches with one click to a **fictitious** student or recruiter account, so no real data is shown. It is **off by default**, also in production.

1. In Render, set `Demo__Enabled=true` and restart the service. Set it back to `false` (or remove it) after the presentation. While it is off, preparing, restoring and switching (`/api/admin/demo/preparar`, `/restaurar`, `/entrar`) answer `404`, the state route still answers (`habilitado: false`), "Voltar ao Admin" still works for a session already open, and the "Demonstração" card does not appear in `/admin`.
2. Sign in as admin, open `/admin` and use the **Demonstração** card:
   - **Preparar demonstração** (shown while the demonstration is not prepared) creates what is missing: 6 fictitious students (one with a full profile) and 1 fictitious recruiter, all with `@demo.invalid` emails. If a real account already uses one of those emails, nothing is changed and the card reports the conflict.
   - Once prepared, the card shows **Ver como Aluno** and **Ver como Recrutador**, which switch the session; the banner **Voltar ao Admin** goes back.
   - **Restaurar demonstração** (also shown once prepared) deletes **only** the fictitious accounts and creates them again, undoing anything done while viewing as them. Real accounts are never touched. An open demonstration session ends and goes back to the login page.
3. Fictitious accounts **never have a password**: they cannot sign in through the login form, and password reset, activation and email links are blocked for them. They are only reachable through the switch of a signed-in admin.
4. The demonstration session keeps the admin's original expiry (it never extends the session time, 8 hours by default). Turning the flag off during a session does not end it; "Voltar ao Admin" still works.
5. Real recruiters never see fictitious students, and the admin lists, dashboard numbers and RPV validations do not count them. The audit screen shows `DEMO_ENTROU` and `DEMO_VOLTOU`; preparing and restoring are audited but hidden from that screen.

The terms of use and privacy notice do not change: no real user data is added.

## Migrating data from the Railway deployment

The previous deployment ran on Railway with SQLite and a `/data` volume. The one-off tool in `backend/tools/SqliteToPostgresMigrator` copies the database and the private files into Neon and R2; see its `README.md` for the exact steps. Summary:

1. Keep the Railway service intact (stopped or read-only) as the rollback path for 7 days after the cutover. A redeploy of Railway needs the last pre-PostgreSQL commit of the repository.
2. Create the empty schema in the target Neon database with `dotnet ef database update` (do not start the API first, so no seed runs).
3. Run the tool with a consistent copy of the SQLite database and the `storage` folder, kept **outside** the repository, and check that the printed counts match.
4. Delete the local copies after the cutover is validated.

Links for account activation and password reset issued before the cutover stop working because the DataProtection keys are not migrated; affected users must request a new link. Login sessions keep working as long as `Jwt__SigningKey` is unchanged.
