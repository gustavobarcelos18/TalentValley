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
    `-- TalentValley.Api/     ASP.NET Core Web API
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
dotnet run --launch-profile https
```

In Development, the OpenAPI document is available at `https://localhost:7102/openapi/v1.json`.

For future local secrets, use `dotnet user-secrets`; do not place secrets in committed configuration files.

## Current phase

Phase 1: database foundation completed. The backend includes the MVP entities, Identity persistence, SQLite configuration, and the `InitialCreate` migration. Authentication flows and business features remain for later phases; no data is seeded.

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
