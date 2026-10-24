# Talent Valley

**[English](#-english)** · **[Português](#-português-brasil)**

---

<a id="-english"></a>

# English

> The career platform for **Rio Pomba Valley** (RPV): trusted, current student profiles and structured talent search for authorized recruiters.

## Table of contents

1. [What is Talent Valley?](#1-what-is-talent-valley)
2. [What the project does](#2-what-the-project-does)
3. [Roles and access](#3-roles-and-access)
4. [Business rules](#4-business-rules)
5. [Security and privacy](#5-security-and-privacy)
6. [Architecture and tech stack](#6-architecture-and-tech-stack)
7. [Repository structure](#7-repository-structure)
8. [Running locally](#8-running-locally)
9. [Configuration reference](#9-configuration-reference)
10. [API overview](#10-api-overview)
11. [Quality checks and CI](#11-quality-checks-and-ci)
12. [Deployment](#12-deployment)
13. [Contributing](#13-contributing)
14. [What Talent Valley is not](#14-what-talent-valley-is-not)

---

## 1. What is Talent Valley?

Talent Valley connects people who are building their careers in the Rio Pomba region with recruiters who want to find them. It is an initiative of Rio Pomba Valley, and the **Institute** (the `ADMIN` role) curates who gets in.

- **Students (talents)** keep one private, structured professional profile: education, experience, competencies, languages, availability, highlighted projects, photo and CV.
- **Recruiters**, approved by the Institute, search those profiles with structured filters, inspect the evidence (including Institute-verified education), save favorites, compare two talents, and then contact the student **outside** the platform.
- **The Institute** reviews every sign-up request, manages accounts, verifies Rio Pomba Valley education certificates, and can audit its own actions.

Student profiles are **never public**. Nobody can find a student through the open internet; only active, authorized recruiters can see them.

## 2. What the project does

### Landing and public pages
- Public landing page (light/dark theme, responsive) explaining the platform to talents and to recruiters, with the Rio Pomba Valley institutional brand.
- Privacy Policy (`/privacidade`) and Terms of Use (`/termos`) pages, written for LGPD (the Brazilian data protection law).

### Access: request → approval → activation → login
Nobody can create an account on their own. The canonical flow is:

```text
PUBLIC REQUEST → ADMIN APPROVAL → ACCOUNT CREATION → ACTIVATION → LOGIN
```

1. A prospective student or recruiter fills in a public **registration request** (multi-step wizard). City/state can be auto-filled from the ZIP code (ViaCEP) and the list of municipalities (IBGE). The requester explicitly consents to the terms; the consent date and terms version are stored.
2. An **admin** reviews the request and approves or rejects it (rejection requires a reason). Only approval creates the account and the matching profile.
3. The person receives an **activation email**, defines a password, and signs in.
4. Admins can also create access directly, and resend activation emails.
5. Rejected requests are deleted after 30 days.

Other account features: forgot/reset password by email, change password while signed in (`/conta/senha`), resend activation, logout.

### For students (`ALUNO`)
Login goes straight to **`/meu-perfil`**, where the student owns and edits only their own profile:

- photo (JPEG, PNG or WebP, up to 5 MB);
- full name, city, state (UF), phone, professional email, optional LinkedIn / GitHub / portfolio links;
- "About me" (bio, up to 1,500 characters);
- **competencies**, chosen from a controlled catalog (no self-assessed skill level);
- **languages** with level (`BASICO`, `INTERMEDIARIO`, `AVANCADO`, `FLUENTE`, `NATIVO`);
- **availability** (`ESTAGIO`, `CLT`, `PJ`, `FREELANCER`, `TRAINEE`) and **work modalities** (`PRESENCIAL`, `HIBRIDO`, `REMOTO`), multiple values allowed;
- **education and certifications** (`CURSO_LIVRE`, `TECNICO`, `TECNOLOGO`, `GRADUACAO`, `POS_GRADUACAO`; statuses `EM_ANDAMENTO`, `CONCLUIDO`, `TRANCADO`), with an optional principal formation and an optional certificate (PDF);
- **Rio Pomba Valley education**: the student can mark a formation as RPV and attach a certificate for the Institute to verify;
- **professional experience** (`PROFISSIONAL` or `ESTAGIO`), including current positions;
- up to **two highlighted projects**, each with description (up to 1,000 characters), technologies from the same competency catalog, and optional demo and repository links;
- a **timeline** (trajectory) that merges education and experience, current items first;
- an uploaded **CV in PDF** (up to 10 MB);
- permanent **deletion of their own account** (LGPD).

### For recruiters (`RECRUTADOR`)
- **Talent search** with 10 results per page and these filters: name, city, state, competencies, formation type, course name, formation status, **Institute-verified RPV formation**, availability and work modality.
- **Sorting**: relevance, recently updated, or name. Relevance is deterministic (never AI, never shown as a percentage).
- **Full talent profile** page with protected access to the photo, CV and certificates.
- **Favorites**: add/remove (idempotent) and list; a favorite whose student is blocked is hidden and comes back when the student is reactivated.
- **Comparison** of exactly two talents, factual only: shared competencies in the center, exclusive ones on each side, plus availability and modality overlap. No score, winner or ranking.
- **Dashboard** with profiles updated since the previous login, new students since then, favorites count and recent favorites.
- Deletion of their own account (LGPD) after confirming the current password.

### For the Institute (`ADMIN`)
- **Dashboard**: active students, active recruiters, pending RPV validations, profiles updated in the last 7 days, verified RPV formations and the most-used competencies.
- **Registration requests**: list, detail, approve, reject (with reason).
- **Students**: list, read-only view of the profile, block, reactivate, delete. Admins cannot edit a student's professional profile.
- **Recruiters**: create, block, reactivate, delete (only after blocking).
- **RPV validation queue**: review the certificate and approve, reject, or remove a verification.
- **Audit log**: read-only, chronological record of important admin actions. It survives deletion of the entity it refers to.

## 3. Roles and access

There are exactly three roles:

| Role | Who | Lands on |
| --- | --- | --- |
| `ALUNO` | Student / talent | `/meu-perfil` |
| `RECRUTADOR` | Recruiter approved by the Institute | `/recrutador` |
| `ADMIN` | The Institute | `/admin` |

Recruiter states are `ATIVO` and `BLOQUEADO`. Students are active or blocked. A blocked account loses access **immediately**, even if it still holds a valid session.

## 4. Business rules

- Student profiles are private; a student cannot make a profile public and cannot edit another student.
- **At most one principal formation.** Choosing a new one automatically un-sets the previous one.
- **RPV validation** (`PENDENTE` → `VERIFICADO` / `REJEITADO`, and `VERIFICADO` → `PENDENTE`):
  - only an admin can verify or reject; verification requires the certificate;
  - if the student changes relevant data or the certificate of a verified/rejected RPV formation, it returns to `PENDENTE`;
  - validation changes never count as a "profile update".
- A completed formation requires an end date; the end date cannot precede the start date. A current experience or project has no end date.
- **Projects**: at most two, in positions 1 and 2. Moving a project into an occupied position swaps them; deleting one makes the other position 1.
- Project technologies use the same competency catalog but **do not** become general competencies of the student.
- **Search combining**: values inside one filter group are OR; different groups are AND. All education criteria must match the *same* formation. Only active students appear.
- **Relevance**: each requested general competency = 2 points, requested project-only competency = 1 point, every other satisfied filter group = 1 point. Ties break by most recent update, then normalized name.
- Languages and professional experience are shown on profiles but are **not** search filters.
- **Audited actions**: student/recruiter created, blocked, reactivated, deleted (by admin or self-service); registration request approved/rejected; RPV approved, rejected, or verification removed.
- **Data retention**: rejected registration requests are removed after 30 days.

## 5. Security and privacy

- **Authentication**: ASP.NET Core Identity + a JWT (HS256) stored **only in an HttpOnly cookie** (`tv_access`, `SameSite=Lax`, `Secure` outside Development). The token is never returned in JSON and never kept in `localStorage`/`sessionStorage`. There are no refresh tokens.
- **Authorization is enforced on the server.** Policies `RequireAdmin`, `RequireActiveStudent`, `RequireActiveRecruiter` re-check the role **and** the current account state in the database on every request. Password reset or an admin block/reactivation rotates the security stamp, so older sessions stop working.
- **CSRF protection**: every `POST/PUT/PATCH/DELETE` requires an `X-XSRF-TOKEN` header (fetched from `GET /api/auth/csrf`) plus an HttpOnly antiforgery cookie.
- **Passwords**: minimum 8 characters with upper case, lower case and a digit; 5 failed attempts lock the account for 15 minutes; email confirmation (activation) is required to sign in. Responses never reveal whether an email exists.
- **Rate limiting** on anonymous endpoints (login, registration requests, activation, password recovery and change): by default 5 requests per minute per IP and endpoint.
- **Private files**: photos, CVs and certificates are **never** exposed by static-file middleware and never stored as database BLOBs. They are served only through authorized API endpoints; storage keys and physical paths never appear in API responses. Uploads are validated by size, extension, declared MIME type and file signature. CVs and certificates download with safe fixed names.
- **File storage**: Cloudflare R2 (private bucket) outside Development; local disk (`App_Data/storage`) in Development only. The API refuses to start outside Development without R2.
- **HTTP hardening**: host filtering (`AllowedHosts` must name the real API host in production), security headers (HSTS, `nosniff`, referrer policy, restrictive CSP), generic problem responses with no exception details, optional trusted-proxy handling for `X-Forwarded-*` limited to configured CIDR ranges.
- **LGPD**: explicit consent with timestamp and terms version, self-service account deletion, deletion cascades that also remove physical files, and logs that never contain passwords, tokens or field values.

## 6. Architecture and tech stack

```text
Browser ──► Next.js (Vercel) ──/api/* rewrite──► ASP.NET Core API (Docker) ──► PostgreSQL
                                                          └────────────────► Cloudflare R2 (private files)
```

The browser only talks to its own origin; Next.js rewrites `/api/*` to the API, so the auth cookie and CSRF flow stay same-origin.

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, MUI / Material Design with a custom Talent Valley theme, Tailwind CSS (layout), Framer Motion (animation), GSAP (landing-page scroll effects) |
| Backend | ASP.NET Core Web API on .NET 10, C#, ASP.NET Core Identity, JWT in HttpOnly cookie, EF Core, REST, OpenAPI document in Development |
| Database | PostgreSQL (Npgsql / EF Core migrations). ASP.NET Core Data Protection keys are stored in the database |
| Files | Cloudflare R2 through the S3 API (`AWSSDK.S3`); local disk in Development |
| Email | Brevo (production); activation/reset links are logged to the console in Development |
| Tests | xUnit .NET integration tests against real PostgreSQL; Vitest + Testing Library on the frontend |
| CI | GitHub Actions (build, tests, migration check, dependency audits, Docker build) and SonarQube Cloud |

Backend design rules: explicit DTOs and explicit mapping (no AutoMapper), EF entities are never exposed by controllers, business rules are enforced in the backend even when the UI also prevents invalid actions.

## 7. Repository structure

```text
TalentValley/
├── AGENTS.md / CLAUDE.md          Rules for contributors and AI tools (read before changing anything)
├── DEPLOY_DEMO.md                 Demo deployment guide (Vercel + Render + Neon + R2)
├── SKILLS-MANIFEST.json           Index of the repository skills
├── dotnet-tools.json              Pinned EF Core CLI tool
├── .agents/skills/                Project skills (architecture, domain rules, security, database…)
├── .github/workflows/             CI (ci.yml) and SonarQube Cloud (sonar.yml)
├── backend/
│   ├── TalentValley.slnx          Backend solution
│   ├── TalentValley.Api/          ASP.NET Core Web API
│   │   ├── Controllers/           REST endpoints
│   │   ├── DTOs/                  Request/response contracts
│   │   ├── Domain/                Entities and enums
│   │   ├── Services/              Business logic
│   │   ├── Authorization/         JWT cookie, policies, antiforgery, rate limiting
│   │   ├── Data/                  DbContext, configurations, migrations
│   │   ├── Storage/               IFileStorage: local disk and Cloudflare R2
│   │   ├── Email/                 Email senders (Brevo, development, unavailable)
│   │   └── Dockerfile
│   ├── TalentValley.Api.Tests/    Integration tests
│   └── tools/
│       ├── SqliteToPostgresMigrator/        One-off SQLite → PostgreSQL + R2 data migration tool
│       └── SqliteToPostgresMigrator.Tests/
└── frontend/                      Next.js application
    └── src/
        ├── app/                   Routes: (public), (auth), (app)
        ├── components/            landing, auth, registration, profile, recruiter, admin, layout…
        ├── lib/                   API client, labels, validation, paths
        └── theme/                 Talent Valley MUI theme
```

Frontend routes: `/` (landing), `/login`, `/cadastro` (+ `/aluno`, `/recrutador`), `/ativar-conta`, `/esqueci-senha`, `/redefinir-senha`, `/reenviar-ativacao`, `/privacidade`, `/termos`, `/meu-perfil`, `/conta/senha`, `/recrutador` (+ `/talentos`, `/talentos/[slug]`, `/favoritos`, `/comparar`), `/admin` (+ `/solicitacoes`, `/alunos`, `/alunos/[id]`, `/recrutadores`, `/validacoes-rpv`, `/auditoria`).

## 8. Running locally

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- Node.js 20.9 or newer (CI uses 22) and npm
- A PostgreSQL server (version 17 is what CI uses). For example, with Docker:

  ```bash
  docker run --name tv-pg -e POSTGRES_PASSWORD=<choose-a-password> -p 5432:5432 -d postgres:17
  ```

### 1. Backend

Run from the repository root (PowerShell). Secrets go in .NET user-secrets, **never** in committed files.

```powershell
# Database connection (create the database "talent_valley" first, or pick an existing one)
dotnet user-secrets set 'ConnectionStrings:DefaultConnection' 'Host=localhost;Database=talent_valley;Username=postgres;Password=<your-password>' --project backend/TalentValley.Api

# JWT signing key: Base64 of at least 32 random bytes
dotnet user-secrets set 'Jwt:SigningKey' ([Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))) --project backend/TalentValley.Api

# Create the schema (the API never applies migrations on its own unless explicitly told to)
dotnet tool restore
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet ef database update --project backend/TalentValley.Api
```

Optional: create a first admin in Development (idempotent; it never resets an existing password):

```powershell
dotnet user-secrets set 'BootstrapAdmin:Email' 'admin@example.test' --project backend/TalentValley.Api
dotnet user-secrets set 'BootstrapAdmin:Name' 'Local Administrator' --project backend/TalentValley.Api
dotnet user-secrets set 'BootstrapAdmin:Password' '<a password that satisfies the policy>' --project backend/TalentValley.Api
```

Start the API:

```bash
cd backend/TalentValley.Api
dotnet run --launch-profile http
```

The API listens on `http://localhost:5087`, OpenAPI is at `/openapi/v1.json`, and the health check is at `/health`. Use the `http` profile with the local frontend so both use the same scheme with `SameSite=Lax` cookies. In Development, activation and password-reset links are **printed in the API console** instead of being emailed. On startup the API seeds the competency and language catalogs (idempotently); no student, recruiter or demo accounts are created.

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local   # keeps NEXT_PUBLIC_API_BASE_URL=http://localhost:5087
npm ci
npm run dev
```

Open `http://localhost:3000`. On Windows, `npm run dev:all` starts both the API and the frontend together.

### 3. Tests

Backend tests need a PostgreSQL server that allows `CREATE DATABASE`; each test gets its own throw-away database.

```powershell
$env:TALENT_VALLEY_TEST_POSTGRES = 'Host=localhost;Username=postgres;Password=<your-password>'
dotnet test backend/TalentValley.slnx
```

```bash
cd frontend
npm test
```

## 9. Configuration reference

Configuration uses standard ASP.NET Core sources (`appsettings*.json`, user-secrets, environment variables with `__` as the separator, e.g. `Jwt__SigningKey`).

| Setting | Purpose |
| --- | --- |
| `ConnectionStrings:DefaultConnection` | PostgreSQL connection string (required) |
| `Jwt:SigningKey` | Base64, at least 32 random bytes (required; startup fails otherwise) |
| `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpirationHours` | Token metadata; lifetime must be > 0 and ≤ 24 hours (default 8) |
| `Frontend:BaseUrl` | Frontend origin, used in activation/reset links and CORS (HTTPS outside Development) |
| `AllowedHosts` | Real API host name(s) in production; `*`, empty or `localhost` are rejected |
| `Storage:Provider` | `R2` (required outside Development) or `Local` (Development) |
| `Storage:R2:AccountId`, `BucketName`, `AccessKeyId`, `SecretAccessKey` | Cloudflare R2 access |
| `Storage:RootPath` | Local storage folder (Development only; defaults to `App_Data/storage`) |
| `Brevo:ApiKey`, `SenderAddress`, `SenderName` | Transactional email; all three are needed for real delivery |
| `DataProtection:KeysPath` | Optional folder for Data Protection keys; empty = keys are kept in the database |
| `Deployment:ApplyMigrationsOnStartup` | `true` makes the API apply migrations at startup (off by default) |
| `Deployment:ForwardedHeaders:Enabled`, `IpRanges`, `ForwardLimit` | Trust `X-Forwarded-*` only from listed proxy CIDR ranges |
| `RateLimiting:PermitLimit` | Requests per minute per IP/endpoint on anonymous endpoints (default 5) |
| `BootstrapAdmin:Enabled`, `Email`, `Name`, `Password` | First-admin bootstrap |
| `Demo:Enabled` | Demonstration mode: lets the admin view the app as a fictitious student/recruiter (off by default; see [DEPLOY_DEMO.md](DEPLOY_DEMO.md)) |
| `NEXT_PUBLIC_API_BASE_URL` (frontend) | Local development only: the browser calls the API directly |
| `BACKEND_API_URL` (frontend, server-side) | Deployed frontend: `/api/*` is rewritten to this API URL |
| `NEXT_PUBLIC_SITE_URL` (frontend) | Public site URL for absolute Open Graph links; must be set before `next build` |

## 10. API overview

All routes are under `/api`. Enum values are exchanged as strings. Errors use RFC 7807 problem responses with a `traceId`.

| Area | Routes (summary) | Access |
| --- | --- | --- |
| Auth | `GET /auth/csrf`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/activate-account`, `/resend-activation`, `/forgot-password`, `/reset-password`, `/change-password` | Public / signed in |
| Registration | `POST /cadastro/aluno`, `POST /cadastro/recrutador` | Public (rate-limited) |
| Catalogs | `GET /competencias?search=`, `GET /idiomas` | Active users |
| Student profile | `GET /alunos/me`; `PUT /alunos/me/dados-basicos`, `/sobre`, `/contato`, `/competencias`, `/idiomas`, `/disponibilidade`; `GET/POST/DELETE /alunos/me/foto` and `/curriculo`; `DELETE /alunos/me` | Active student |
| Education / experience / projects | `GET/POST /alunos/me/formacoes`, `PUT/DELETE …/{id}`, `POST/GET/DELETE …/{id}/certificado`; same pattern for `/experiencias` and `/projetos`; `GET /alunos/me/trajetoria` | Active student |
| Talent discovery | `GET /talentos` (filters, sort, `page`), `GET /talentos/{slug}`, `…/foto`, `…/curriculo`, `…/formacoes/{id}/certificado` | Active recruiter |
| Favorites / compare | `GET /recrutador/favoritos`, `POST/DELETE /recrutador/favoritos/{slug}`, `GET /recrutador/comparar?slugs=a&slugs=b`, `GET /recrutador/dashboard`, `DELETE /recrutador/me` | Active recruiter |
| Admin | `/admin/dashboard`, `/admin/solicitacoes-cadastro`, `/admin/alunos`, `/admin/recrutadores`, `/admin/usuarios/{id}/reenviar-ativacao`, `/admin/validacoes-rpv`, `/admin/auditoria` | Admin |

Search query parameters on `GET /talentos`: `nome`, `cidade`, `uf`, repeated `competenciaIds`, repeated `tiposFormacao`, `formacaoNome`, repeated `statusFormacao`, `rpvVerificado=true`, repeated `disponibilidades`, repeated `modalidades`, `ordenacao` (`relevancia`, `recentes` or `nome`) and `page`. In Development the full contract is in the OpenAPI document.

**Request flow for browsers/clients**: (1) `GET /api/auth/csrf` with credentials and keep the token in memory; (2) send it as `X-XSRF-TOKEN` on every mutating request; (3) `POST /api/auth/login` with `{ "email", "senha" }` → the response includes the role's initial destination; (4) fetch a new CSRF token after login and logout.

## 11. Quality checks and CI

Before considering a change done, run what applies to the files you touched:

```powershell
# Backend (from the repository root)
dotnet build backend/TalentValley.slnx
dotnet test backend/TalentValley.slnx

# If the database model changed (entities, configurations or AppDbContext)
dotnet tool restore
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet ef migrations add <MigrationName> --project backend/TalentValley.Api --output-dir Data/Migrations
dotnet ef migrations has-pending-model-changes --project backend/TalentValley.Api   # must report no pending changes
```

```bash
# Frontend (inside frontend/)
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

GitHub Actions runs all of this on every push and pull request, plus a vulnerable-package audit (.NET and `npm audit`), a Docker build of the API and validation of the skills manifest. SonarQube Cloud analyzes `main` and pull requests. A failing check must be fixed, never bypassed. Schema changes always go in a **new** migration; migrations already in `main` are never edited.

## 12. Deployment

The reference demo setup is documented step by step in **[DEPLOY_DEMO.md](DEPLOY_DEMO.md)**:

**Vercel** (frontend) → **Render** (API, Docker, `/health` check) → **Neon** (PostgreSQL) + **Cloudflare R2** (private files).

> That guide is for **demo/evaluation**. It lists the deviations to review before a real production release (database role separation, encryption of Data Protection keys, formal migration process) and notes that account activation and password reset need working Brevo email in production.

`backend/tools/SqliteToPostgresMigrator` is a one-off tool used to move the earlier SQLite + volume deployment to PostgreSQL + R2; see its README.

## 13. Contributing

Please read **[AGENTS.md](AGENTS.md)** first. It applies to every contributor and every AI tool. Highlights:

- Implement only the requested scope; do not add packages, frameworks or abstractions nobody asked for.
- Work on a new branch from `origin/main`, named `<type>/<short-description>` (e.g. `feat/talent-filter-by-city`); one branch, one task.
- Commits follow Conventional Commits (`feat: …`, `fix: …`).
- Never push to `main`, force-push or merge a pull request: **only the maintainer merges**.
- Never commit secrets (`.env`, tokens, passwords, keys) or real personal data.
- Never delete, skip or weaken tests or lint rules to make a check pass.
- Adding/removing/upgrading dependencies, changing authentication/authorization, editing existing migrations, and changing CI or deployment need the maintainer's decision.

## 14. What Talent Valley is not

The MVP is deliberately **not** an applicant tracking system, a job board, an interview pipeline, or an internal messaging system. Recruiters discover students, inspect evidence and contact them externally. There is also no generated CV, no student dashboard, no public profile pages, and no AI-based ranking.

---

<a id="-português-brasil"></a>

#Português (Brasil)

> A plataforma de carreira do **Rio Pomba Valley** (RPV): perfis de estudantes confiáveis e atualizados, e busca estruturada de talentos para recrutadores autorizados.

## Sumário

1. [O que é o Talent Valley?](#1-o-que-é-o-talent-valley)
2. [O que o projeto faz](#2-o-que-o-projeto-faz)
3. [Papéis e acesso](#3-papéis-e-acesso)
4. [Regras de negócio](#4-regras-de-negócio)
5. [Segurança e privacidade](#5-segurança-e-privacidade)
6. [Arquitetura e tecnologias](#6-arquitetura-e-tecnologias)
7. [Estrutura do repositório](#7-estrutura-do-repositório)
8. [Rodando localmente](#8-rodando-localmente)
9. [Referência de configuração](#9-referência-de-configuração)
10. [Visão geral da API](#10-visão-geral-da-api)
11. [Verificações de qualidade e CI](#11-verificações-de-qualidade-e-ci)
12. [Deploy](#12-deploy)
13. [Como contribuir](#13-como-contribuir)
14. [O que o Talent Valley não é](#14-o-que-o-talent-valley-não-é)

---

## 1. O que é o Talent Valley?

O Talent Valley conecta pessoas que estão construindo a carreira na região de Rio Pomba a recrutadores que querem encontrá-las. É uma iniciativa do Rio Pomba Valley, e o **Instituto** (o papel `ADMIN`) decide quem entra na plataforma.

- **Estudantes (talentos)** mantêm um único perfil profissional, privado e estruturado: formação, experiência, competências, idiomas, disponibilidade, projetos em destaque, foto e currículo.
- **Recrutadores**, aprovados pelo Instituto, buscam esses perfis com filtros estruturados, avaliam as evidências (inclusive formações verificadas pelo Instituto), salvam favoritos, comparam dois talentos e depois entram em contato com o estudante **fora** da plataforma.
- **O Instituto** analisa todos os pedidos de cadastro, gerencia contas, verifica certificados de formação do Rio Pomba Valley e pode auditar as próprias ações.

Os perfis de estudantes **nunca são públicos**. Ninguém encontra um estudante pela internet aberta; só recrutadores ativos e autorizados enxergam os perfis.

## 2. O que o projeto faz

### Página inicial e páginas públicas
- Landing page pública (tema claro/escuro, responsiva) que apresenta a plataforma para talentos e para recrutadores, com a marca institucional do Rio Pomba Valley.
- Páginas de Política de Privacidade (`/privacidade`) e Termos de Uso (`/termos`), escritas considerando a LGPD.

### Acesso: pedido → aprovação → ativação → login
Ninguém cria conta sozinho. O fluxo oficial é:

```text
PEDIDO PÚBLICO → APROVAÇÃO DO ADMIN → CRIAÇÃO DA CONTA → ATIVAÇÃO → LOGIN
```

1. Quem quer entrar (estudante ou recrutador) preenche um **pedido de cadastro** público (formulário em etapas). Cidade e UF podem ser preenchidas automaticamente pelo CEP (ViaCEP) e pela lista de municípios (IBGE). A pessoa dá consentimento explícito aos termos; a data do aceite e a versão dos termos ficam registradas.
2. Um **admin** analisa o pedido e aprova ou rejeita (a rejeição exige um motivo). Só a aprovação cria a conta e o perfil correspondente.
3. A pessoa recebe um **e-mail de ativação**, define a senha e entra.
4. Admins também podem criar acessos diretamente e reenviar e-mails de ativação.
5. Pedidos rejeitados são apagados depois de 30 dias.

Outras funções de conta: esqueci/redefinir senha por e-mail, alterar senha estando logado (`/conta/senha`), reenviar ativação e sair (logout).

### Para estudantes (`ALUNO`)
O login leva direto para **`/meu-perfil`**, onde o estudante é dono e edita somente o próprio perfil:

- foto (JPEG, PNG ou WebP, até 5 MB);
- nome completo, cidade, UF, telefone, e-mail profissional e links opcionais de LinkedIn / GitHub / portfólio;
- "Sobre mim" (bio, até 1.500 caracteres);
- **competências**, escolhidas de um catálogo controlado (sem autoavaliação de nível);
- **idiomas** com nível (`BASICO`, `INTERMEDIARIO`, `AVANCADO`, `FLUENTE`, `NATIVO`);
- **disponibilidade** (`ESTAGIO`, `CLT`, `PJ`, `FREELANCER`, `TRAINEE`) e **modalidades de trabalho** (`PRESENCIAL`, `HIBRIDO`, `REMOTO`), com múltiplos valores;
- **formações e certificações** (`CURSO_LIVRE`, `TECNICO`, `TECNOLOGO`, `GRADUACAO`, `POS_GRADUACAO`; status `EM_ANDAMENTO`, `CONCLUIDO`, `TRANCADO`), com formação principal opcional e certificado (PDF) opcional;
- **formação Rio Pomba Valley**: o estudante pode marcar uma formação como RPV e anexar o certificado para o Instituto verificar;
- **experiência profissional** (`PROFISSIONAL` ou `ESTAGIO`), inclusive cargos atuais;
- até **dois projetos em destaque**, cada um com descrição (até 1.000 caracteres), tecnologias do mesmo catálogo de competências e links opcionais de demonstração e repositório;
- uma **trajetória** (linha do tempo) que junta formações e experiências, com os itens atuais primeiro;
- **currículo em PDF** enviado pelo estudante (até 10 MB);
- **exclusão definitiva da própria conta** (LGPD).

### Para recrutadores (`RECRUTADOR`)
- **Busca de talentos** com 10 resultados por página e estes filtros: nome, cidade, UF, competências, tipo de formação, nome do curso, status da formação, **formação RPV verificada pelo Instituto**, disponibilidade e modalidade de trabalho.
- **Ordenação**: relevância, atualizados recentemente ou nome. A relevância é determinística (nunca usa IA e nunca aparece como porcentagem).
- **Página completa do perfil** do talento, com acesso protegido à foto, ao currículo e aos certificados.
- **Favoritos**: adicionar/remover (idempotente) e listar; o favorito de um estudante bloqueado fica oculto e volta quando o estudante é reativado.
- **Comparação** de exatamente dois talentos, apenas com fatos: competências em comum no centro, exclusivas de cada lado, além do que há em comum de disponibilidade e modalidade. Sem nota, vencedor ou ranking.
- **Painel** com perfis atualizados desde o login anterior, novos estudantes desde então, quantidade de favoritos e favoritos recentes.
- Exclusão da própria conta (LGPD) após confirmar a senha atual.

### Para o Instituto (`ADMIN`)
- **Painel**: estudantes ativos, recrutadores ativos, validações RPV pendentes, perfis atualizados nos últimos 7 dias, formações RPV verificadas e as competências mais usadas.
- **Pedidos de cadastro**: listar, ver detalhe, aprovar e rejeitar (com motivo).
- **Estudantes**: listar, ver o perfil somente para leitura, bloquear, reativar e excluir. Admins não editam o perfil profissional do estudante.
- **Recrutadores**: criar, bloquear, reativar e excluir (só depois de bloquear).
- **Fila de validação RPV**: conferir o certificado e aprovar, rejeitar ou remover uma verificação.
- **Auditoria**: registro cronológico, somente leitura, das ações importantes de admin. Ele continua existindo mesmo depois que a entidade citada é excluída.

## 3. Papéis e acesso

Existem exatamente três papéis:

| Papel | Quem é | Destino após o login |
| --- | --- | --- |
| `ALUNO` | Estudante / talento | `/meu-perfil` |
| `RECRUTADOR` | Recrutador aprovado pelo Instituto | `/recrutador` |
| `ADMIN` | O Instituto | `/admin` |

Os estados do recrutador são `ATIVO` e `BLOQUEADO`. Estudantes ficam ativos ou bloqueados. Uma conta bloqueada perde o acesso **imediatamente**, mesmo que ainda tenha uma sessão válida.

## 4. Regras de negócio

- Perfis de estudantes são privados; o estudante não pode tornar o perfil público nem editar outro estudante.
- **No máximo uma formação principal.** Escolher uma nova desmarca a anterior automaticamente.
- **Validação RPV** (`PENDENTE` → `VERIFICADO` / `REJEITADO`, e `VERIFICADO` → `PENDENTE`):
  - só admin verifica ou rejeita; a verificação exige o certificado;
  - se o estudante alterar dados relevantes ou o certificado de uma formação RPV verificada/rejeitada, ela volta para `PENDENTE`;
  - mudanças de validação nunca contam como "atualização de perfil".
- Formação concluída exige data de término, que não pode ser anterior ao início. Experiência ou projeto atual não tem data de término.
- **Projetos**: no máximo dois, nas posições 1 e 2. Mover um projeto para uma posição ocupada troca os dois de lugar; excluir um faz o outro virar posição 1.
- As tecnologias de um projeto usam o mesmo catálogo de competências, mas **não** viram competências gerais do estudante.
- **Combinação de filtros**: valores dentro de um mesmo grupo são OU; grupos diferentes são E. Todos os critérios de formação precisam bater na *mesma* formação. Só estudantes ativos aparecem.
- **Relevância**: cada competência geral pedida = 2 pontos, competência pedida só em projeto = 1 ponto, cada outro grupo de filtro satisfeito = 1 ponto. Empates são desfeitos pela atualização mais recente e depois pelo nome normalizado.
- Idiomas e experiência profissional aparecem nos perfis, mas **não** são filtros de busca.
- **Ações auditadas**: estudante/recrutador criado, bloqueado, reativado, excluído (por admin ou pela própria pessoa); pedido de cadastro aprovado/rejeitado; RPV aprovada, rejeitada ou verificação removida.
- **Retenção de dados**: pedidos de cadastro rejeitados são removidos após 30 dias.

## 5. Segurança e privacidade

- **Autenticação**: ASP.NET Core Identity + JWT (HS256) guardado **somente em cookie HttpOnly** (`tv_access`, `SameSite=Lax`, `Secure` fora de Desenvolvimento). O token nunca é devolvido em JSON e nunca fica em `localStorage`/`sessionStorage`. Não há refresh token.
- **A autorização é feita no servidor.** As políticas `RequireAdmin`, `RequireActiveStudent` e `RequireActiveRecruiter` conferem o papel **e** o estado atual da conta no banco a cada requisição. Redefinir a senha ou bloquear/reativar uma conta troca o *security stamp*, e as sessões antigas deixam de funcionar.
- **Proteção contra CSRF**: toda requisição `POST/PUT/PATCH/DELETE` exige o cabeçalho `X-XSRF-TOKEN` (obtido em `GET /api/auth/csrf`) e um cookie antiforgery HttpOnly.
- **Senhas**: mínimo de 8 caracteres com maiúscula, minúscula e número; 5 tentativas erradas bloqueiam a conta por 15 minutos; é preciso confirmar o e-mail (ativação) para entrar. As respostas nunca revelam se um e-mail existe.
- **Limite de requisições** nos endpoints anônimos (login, pedido de cadastro, ativação, recuperação e troca de senha): por padrão 5 por minuto, por IP e por endpoint.
- **Arquivos privados**: fotos, currículos e certificados **nunca** são expostos como arquivos estáticos e nunca são guardados como BLOB no banco. Eles só saem por endpoints autorizados da API; chaves de armazenamento e caminhos físicos nunca aparecem nas respostas. Os envios são validados por tamanho, extensão, tipo MIME declarado e assinatura do arquivo. Currículos e certificados são baixados com nomes fixos e seguros.
- **Armazenamento de arquivos**: Cloudflare R2 (bucket privado) fora de Desenvolvimento; disco local (`App_Data/storage`) só em Desenvolvimento. A API se recusa a iniciar fora de Desenvolvimento sem R2.
- **Endurecimento HTTP**: filtro de hosts (`AllowedHosts` deve ter o host real da API em produção), cabeçalhos de segurança (HSTS, `nosniff`, referrer policy, CSP restritiva), respostas de erro genéricas sem detalhes de exceção, e tratamento opcional de `X-Forwarded-*` limitado às faixas CIDR configuradas.
- **LGPD**: consentimento explícito com data e versão dos termos, exclusão da própria conta, exclusão em cascata que também apaga os arquivos físicos, e logs que nunca contêm senhas, tokens nem valores de campos.

## 6. Arquitetura e tecnologias

```text
Navegador ──► Next.js (Vercel) ──reescrita /api/*──► API ASP.NET Core (Docker) ──► PostgreSQL
                                                              └──────────────────► Cloudflare R2 (arquivos privados)
```

O navegador conversa apenas com a própria origem; o Next.js reescreve `/api/*` para a API, então o cookie de login e o fluxo de CSRF continuam na mesma origem.

| Camada | Tecnologia |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, MUI / Material Design com tema próprio do Talent Valley, Tailwind CSS (layout), Framer Motion (animações), GSAP (efeitos de rolagem da landing page) |
| Backend | ASP.NET Core Web API no .NET 10, C#, ASP.NET Core Identity, JWT em cookie HttpOnly, EF Core, REST, documento OpenAPI em Desenvolvimento |
| Banco de dados | PostgreSQL (Npgsql / migrations do EF Core). As chaves do Data Protection ficam no banco |
| Arquivos | Cloudflare R2 pela API S3 (`AWSSDK.S3`); disco local em Desenvolvimento |
| E-mail | Brevo (produção); em Desenvolvimento os links de ativação/redefinição aparecem no console |
| Testes | Testes de integração .NET com PostgreSQL real; Vitest + Testing Library no frontend |
| CI | GitHub Actions (build, testes, checagem de migrations, auditoria de dependências, build Docker) e SonarQube Cloud |

Regras de projeto do backend: DTOs e mapeamentos explícitos (sem AutoMapper), controllers nunca expõem entidades do EF, e as regras de negócio são garantidas no backend mesmo quando a interface também impede ações inválidas.

## 7. Estrutura do repositório

```text
TalentValley/
├── AGENTS.md / CLAUDE.md          Regras para contribuidores e ferramentas de IA (leia antes de mudar qualquer coisa)
├── DEPLOY_DEMO.md                 Guia de deploy da demo (Vercel + Render + Neon + R2)
├── SKILLS-MANIFEST.json           Índice das skills do repositório
├── dotnet-tools.json              Ferramenta de linha de comando do EF Core (versão fixa)
├── .agents/skills/                Skills do projeto (arquitetura, regras de domínio, segurança, banco…)
├── .github/workflows/             CI (ci.yml) e SonarQube Cloud (sonar.yml)
├── backend/
│   ├── TalentValley.slnx          Solução do backend
│   ├── TalentValley.Api/          API ASP.NET Core
│   │   ├── Controllers/           Endpoints REST
│   │   ├── DTOs/                  Contratos de requisição/resposta
│   │   ├── Domain/                Entidades e enums
│   │   ├── Services/              Lógica de negócio
│   │   ├── Authorization/         Cookie JWT, políticas, antiforgery, rate limiting
│   │   ├── Data/                  DbContext, configurações, migrations
│   │   ├── Storage/               IFileStorage: disco local e Cloudflare R2
│   │   ├── Email/                 Envio de e-mail (Brevo, desenvolvimento, indisponível)
│   │   └── Dockerfile
│   ├── TalentValley.Api.Tests/    Testes de integração
│   └── tools/
│       ├── SqliteToPostgresMigrator/        Ferramenta de uso único: SQLite → PostgreSQL + R2
│       └── SqliteToPostgresMigrator.Tests/
└── frontend/                      Aplicação Next.js
    └── src/
        ├── app/                   Rotas: (public), (auth), (app)
        ├── components/            landing, auth, registration, profile, recruiter, admin, layout…
        ├── lib/                   Cliente da API, rótulos, validação, caminhos
        └── theme/                 Tema MUI do Talent Valley
```

Rotas do frontend: `/` (landing), `/login`, `/cadastro` (+ `/aluno`, `/recrutador`), `/ativar-conta`, `/esqueci-senha`, `/redefinir-senha`, `/reenviar-ativacao`, `/privacidade`, `/termos`, `/meu-perfil`, `/conta/senha`, `/recrutador` (+ `/talentos`, `/talentos/[slug]`, `/favoritos`, `/comparar`), `/admin` (+ `/solicitacoes`, `/alunos`, `/alunos/[id]`, `/recrutadores`, `/validacoes-rpv`, `/auditoria`).

## 8. Rodando localmente

### Pré-requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- Node.js 20.9 ou superior (o CI usa 22) e npm
- Um servidor PostgreSQL (o CI usa a versão 17). Por exemplo, com Docker:

  ```bash
  docker run --name tv-pg -e POSTGRES_PASSWORD=<escolha-uma-senha> -p 5432:5432 -d postgres:17
  ```

### 1. Backend

Rode a partir da raiz do repositório (PowerShell). Segredos ficam nos *user-secrets* do .NET, **nunca** em arquivos versionados.

```powershell
# Conexão com o banco (crie antes o banco "talent_valley", ou use um já existente)
dotnet user-secrets set 'ConnectionStrings:DefaultConnection' 'Host=localhost;Database=talent_valley;Username=postgres;Password=<sua-senha>' --project backend/TalentValley.Api

# Chave de assinatura do JWT: Base64 de pelo menos 32 bytes aleatórios
dotnet user-secrets set 'Jwt:SigningKey' ([Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))) --project backend/TalentValley.Api

# Criar o schema (a API não aplica migrations sozinha, a menos que seja configurada para isso)
dotnet tool restore
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet ef database update --project backend/TalentValley.Api
```

Opcional: criar um primeiro admin em Desenvolvimento (idempotente; nunca redefine a senha de um admin existente):

```powershell
dotnet user-secrets set 'BootstrapAdmin:Email' 'admin@example.test' --project backend/TalentValley.Api
dotnet user-secrets set 'BootstrapAdmin:Name' 'Administrador Local' --project backend/TalentValley.Api
dotnet user-secrets set 'BootstrapAdmin:Password' '<uma senha que atenda à política>' --project backend/TalentValley.Api
```

Inicie a API:

```bash
cd backend/TalentValley.Api
dotnet run --launch-profile http
```

A API escuta em `http://localhost:5087`, o OpenAPI fica em `/openapi/v1.json` e a checagem de saúde em `/health`. Use o perfil `http` com o frontend local para que os dois usem o mesmo esquema, com cookies `SameSite=Lax`. Em Desenvolvimento, os links de ativação e de redefinição de senha são **impressos no console da API** em vez de enviados por e-mail. Ao iniciar, a API popula os catálogos de competências e idiomas (de forma idempotente); nenhuma conta de estudante, recrutador ou demonstração é criada.

### 2. Frontend

```bash
cd frontend
cp .env.example .env.local   # mantém NEXT_PUBLIC_API_BASE_URL=http://localhost:5087
npm ci
npm run dev
```

Abra `http://localhost:3000`. No Windows, `npm run dev:all` inicia a API e o frontend juntos.

### 3. Testes

Os testes do backend precisam de um servidor PostgreSQL que permita `CREATE DATABASE`; cada teste recebe seu próprio banco descartável.

```powershell
$env:TALENT_VALLEY_TEST_POSTGRES = 'Host=localhost;Username=postgres;Password=<sua-senha>'
dotnet test backend/TalentValley.slnx
```

```bash
cd frontend
npm test
```

## 9. Referência de configuração

A configuração usa as fontes padrão do ASP.NET Core (`appsettings*.json`, user-secrets e variáveis de ambiente com `__` como separador, por exemplo `Jwt__SigningKey`).

| Configuração | Para que serve |
| --- | --- |
| `ConnectionStrings:DefaultConnection` | String de conexão do PostgreSQL (obrigatória) |
| `Jwt:SigningKey` | Base64 de pelo menos 32 bytes aleatórios (obrigatória; a API não inicia sem ela) |
| `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpirationHours` | Metadados do token; a validade deve ser > 0 e ≤ 24 horas (padrão 8) |
| `Frontend:BaseUrl` | Origem do frontend, usada nos links de ativação/redefinição e no CORS (HTTPS fora de Desenvolvimento) |
| `AllowedHosts` | Nome(s) real(is) do host da API em produção; `*`, vazio ou `localhost` são recusados |
| `Storage:Provider` | `R2` (obrigatório fora de Desenvolvimento) ou `Local` (Desenvolvimento) |
| `Storage:R2:AccountId`, `BucketName`, `AccessKeyId`, `SecretAccessKey` | Acesso ao Cloudflare R2 |
| `Storage:RootPath` | Pasta de armazenamento local (só Desenvolvimento; padrão `App_Data/storage`) |
| `Brevo:ApiKey`, `SenderAddress`, `SenderName` | E-mail transacional; os três são necessários para envio real |
| `DataProtection:KeysPath` | Pasta opcional para as chaves do Data Protection; vazio = chaves ficam no banco |
| `Deployment:ApplyMigrationsOnStartup` | `true` faz a API aplicar as migrations ao iniciar (desligado por padrão) |
| `Deployment:ForwardedHeaders:Enabled`, `IpRanges`, `ForwardLimit` | Confiar em `X-Forwarded-*` só de proxies nas faixas CIDR listadas |
| `RateLimiting:PermitLimit` | Requisições por minuto por IP/endpoint nos endpoints anônimos (padrão 5) |
| `BootstrapAdmin:Enabled`, `Email`, `Name`, `Password` | Criação do primeiro admin |
| `Demo:Enabled` | Modo demonstração: o admin vê o sistema como aluno/recrutador fictício (desligado por padrão; veja [DEPLOY_DEMO.md](DEPLOY_DEMO.md)) |
| `NEXT_PUBLIC_API_BASE_URL` (frontend) | Só desenvolvimento local: o navegador chama a API diretamente |
| `BACKEND_API_URL` (frontend, lado servidor) | Frontend publicado: `/api/*` é reescrito para essa URL da API |
| `NEXT_PUBLIC_SITE_URL` (frontend) | URL pública do site para links absolutos do Open Graph; deve ser definida antes do `next build` |

## 10. Visão geral da API

Todas as rotas ficam em `/api`. Os valores de enum trafegam como texto. Os erros usam respostas de problema (RFC 7807) com um `traceId`.

| Área | Rotas (resumo) | Acesso |
| --- | --- | --- |
| Autenticação | `GET /auth/csrf`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/activate-account`, `/resend-activation`, `/forgot-password`, `/reset-password`, `/change-password` | Público / logado |
| Cadastro | `POST /cadastro/aluno`, `POST /cadastro/recrutador` | Público (com limite de requisições) |
| Catálogos | `GET /competencias?search=`, `GET /idiomas` | Usuários ativos |
| Perfil do estudante | `GET /alunos/me`; `PUT /alunos/me/dados-basicos`, `/sobre`, `/contato`, `/competencias`, `/idiomas`, `/disponibilidade`; `GET/POST/DELETE /alunos/me/foto` e `/curriculo`; `DELETE /alunos/me` | Estudante ativo |
| Formações / experiências / projetos | `GET/POST /alunos/me/formacoes`, `PUT/DELETE …/{id}`, `POST/GET/DELETE …/{id}/certificado`; mesmo padrão para `/experiencias` e `/projetos`; `GET /alunos/me/trajetoria` | Estudante ativo |
| Busca de talentos | `GET /talentos` (filtros, ordenação, `page`), `GET /talentos/{slug}`, `…/foto`, `…/curriculo`, `…/formacoes/{id}/certificado` | Recrutador ativo |
| Favoritos / comparação | `GET /recrutador/favoritos`, `POST/DELETE /recrutador/favoritos/{slug}`, `GET /recrutador/comparar?slugs=a&slugs=b`, `GET /recrutador/dashboard`, `DELETE /recrutador/me` | Recrutador ativo |
| Admin | `/admin/dashboard`, `/admin/solicitacoes-cadastro`, `/admin/alunos`, `/admin/recrutadores`, `/admin/usuarios/{id}/reenviar-ativacao`, `/admin/validacoes-rpv`, `/admin/auditoria` | Admin |

Parâmetros de busca em `GET /talentos`: `nome`, `cidade`, `uf`, `competenciaIds` (repetido), `tiposFormacao` (repetido), `formacaoNome`, `statusFormacao` (repetido), `rpvVerificado=true`, `disponibilidades` (repetido), `modalidades` (repetido), `ordenacao` (`relevancia`, `recentes` ou `nome`) e `page`. Em Desenvolvimento, o contrato completo está no documento OpenAPI.

**Fluxo de requisições para navegadores/clientes**: (1) `GET /api/auth/csrf` com credenciais e guardar o token em memória; (2) enviá-lo como `X-XSRF-TOKEN` em toda requisição que altera dados; (3) `POST /api/auth/login` com `{ "email", "senha" }` → a resposta traz o destino inicial do papel; (4) buscar um novo token CSRF após o login e após o logout.

## 11. Verificações de qualidade e CI

Antes de considerar uma mudança pronta, rode o que se aplica aos arquivos alterados:

```powershell
# Backend (a partir da raiz do repositório)
dotnet build backend/TalentValley.slnx
dotnet test backend/TalentValley.slnx

# Se o modelo do banco mudou (entidades, configurações ou AppDbContext)
dotnet tool restore
$env:ASPNETCORE_ENVIRONMENT = 'Development'
dotnet ef migrations add <NomeDaMigration> --project backend/TalentValley.Api --output-dir Data/Migrations
dotnet ef migrations has-pending-model-changes --project backend/TalentValley.Api   # deve informar que não há mudanças pendentes
```

```bash
# Frontend (dentro de frontend/)
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

O GitHub Actions executa tudo isso a cada push e pull request, além de auditoria de pacotes vulneráveis (.NET e `npm audit`), build Docker da API e validação do manifesto de skills. O SonarQube Cloud analisa a `main` e os pull requests. Uma verificação que falha deve ser corrigida, nunca contornada. Mudanças de schema sempre vão em uma **nova** migration; migrations que já estão na `main` nunca são editadas.

## 12. Deploy

A configuração de referência da demo está documentada passo a passo em **[DEPLOY_DEMO.md](DEPLOY_DEMO.md)** (em inglês):

**Vercel** (frontend) → **Render** (API, Docker, checagem em `/health`) → **Neon** (PostgreSQL) + **Cloudflare R2** (arquivos privados).

> Esse guia é para **demonstração/avaliação**. Ele lista os desvios a revisar antes de um lançamento real em produção (separação de papéis do banco, criptografia das chaves do Data Protection, processo formal de migrations) e avisa que ativação de conta e redefinição de senha precisam de e-mail Brevo funcionando em produção.

`backend/tools/SqliteToPostgresMigrator` é uma ferramenta de uso único usada para mover a implantação anterior (SQLite + volume) para PostgreSQL + R2; veja o README dela.

## 13. Como contribuir

Leia primeiro o **[AGENTS.md](AGENTS.md)**. Ele vale para todo contribuidor e toda ferramenta de IA. Principais pontos:

- Implemente somente o escopo pedido; não adicione pacotes, frameworks ou abstrações que ninguém pediu.
- Trabalhe em uma branch nova a partir de `origin/main`, nomeada `<tipo>/<descricao-curta>` (ex.: `feat/talent-filter-by-city`); uma branch, uma tarefa.
- Os commits seguem Conventional Commits (`feat: …`, `fix: …`).
- Nunca faça push na `main`, force-push nem merge de pull request: **só o maintainer faz merge**.
- Nunca faça commit de segredos (`.env`, tokens, senhas, chaves) nem de dados pessoais reais.
- Nunca apague, pule ou enfraqueça testes ou regras de lint para fazer uma verificação passar.
- Adicionar/remover/atualizar dependências, mudar autenticação/autorização, editar migrations existentes e alterar CI ou deploy dependem da decisão do maintainer.

## 14. O que o Talent Valley não é

O MVP **não** é, de propósito, um sistema de acompanhamento de candidaturas (ATS), um quadro de vagas, um funil de entrevistas nem um sistema de mensagens interno. Recrutadores descobrem estudantes, avaliam as evidências e entram em contato externamente. Também não há currículo gerado pela plataforma, painel do estudante, páginas públicas de perfil nem ranqueamento por IA.
