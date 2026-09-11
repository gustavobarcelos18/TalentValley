# Approved Talent Valley Architecture

## Product

Talent Valley — Career Platform by Rio Pomba Valley.

Purpose:
- students maintain their professional profiles;
- the Institute controls access and institutional validation;
- authorized recruiters discover and inspect students;
- recruiter contact happens outside the platform.

## Applications

```text
talent-valley/
├── frontend/
└── backend/
```

### Frontend

- Next.js
- React
- TypeScript
- MUI with a custom Talent Valley/RPV theme
- Tailwind CSS mainly for layout and composition
- Framer Motion for standard animation
- GSAP only for sophisticated landing-page scroll/parallax

Do not add Lucide. Prefer the Material Design ecosystem.

### Backend

- ASP.NET Core Web API
- ASP.NET Core Identity
- JWT
- HttpOnly cookie
- EF Core
- SQLite
- EF migrations
- SQLite WAL
- REST

Keep one API project for the MVP. Do not create Clean Architecture project sprawl unless explicitly requested.

## Primary backend folders

Suggested structure:

```text
TalentValley.Api/
├── Authorization/
├── Controllers/
├── Data/
│   └── Configurations/
├── Domain/
│   ├── Entities/
│   └── Enums/
├── DTOs/
├── Email/
├── Services/
├── Storage/
├── Migrations/
└── Program.cs
```

## Files

Uploaded files are not BLOBs.

Use:
- `IFileStorage`
- `LocalFileStorage` for MVP
- persisted storage keys in DB

Protected documents must be served through authorized API endpoints.

## Derived concepts that are not entities

Do not create database tables for:
- trajectory;
- comparison;
- relevance score;
- dashboard;
- profile preview;
- updated-since-last-login.

These are query/read-model concepts.

## Simplicity rules

- explicit mapping instead of AutoMapper;
- DataAnnotations/simple request validation plus service-level business rules;
- enums persisted as strings;
- `DateOnly` for dates without time;
- `DateTimeOffset` for real events/timestamps;
- no unnecessary generic repositories over EF Core;
- no unnecessary mediator/event-bus architecture;
- no microservices.
