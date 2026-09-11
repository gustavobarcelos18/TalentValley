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

Phase 0 contains scaffold only. No domain entities, authentication flow, persistence schema, migrations, or business features are implemented.
