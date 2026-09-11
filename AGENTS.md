# Talent Valley — Repository Agent Guide

Talent Valley is the career platform for Rio Pomba Valley.

## Product purpose

Maintain trusted, current student profiles and let authorized recruiters discover talent through structured search.

This MVP is **not**:
- an ATS;
- a job board;
- an interview pipeline;
- an internal messaging system.

Recruiters discover students, inspect evidence, and contact them externally.

## Approved stack

### Frontend
- Next.js
- React
- TypeScript
- MUI / Material Design
- custom Talent Valley theme
- Tailwind CSS for layout/composition
- Framer Motion for normal animation
- GSAP only for advanced landing-page scroll/parallax

### Backend
- ASP.NET Core Web API
- C#
- ASP.NET Core Identity
- JWT stored in HttpOnly cookie
- EF Core
- SQLite with WAL
- REST API

## Roles

Only:
- `ALUNO`
- `RECRUTADOR`
- `ADMIN`

`ADMIN` represents the Institute.

## Global engineering rules

1. Implement only the requested scope.
2. Do not introduce unrequested features, packages, frameworks, layers, or abstractions.
3. Preserve approved architecture unless the task explicitly changes it.
4. Do not edit unrelated files.
5. Do not expose EF Core entities directly from API controllers.
6. Use explicit DTOs and explicit mapping. Do not add AutoMapper.
7. Do not store JWT in localStorage or sessionStorage.
8. Do not store uploaded files as database BLOBs.
9. Do not make student profiles public.
10. Never trust frontend-only authorization or business-rule enforcement.
11. Prefer simple, readable code over speculative extensibility.
12. Do not replace approved technologies.
13. Run the relevant quality checks before declaring a task complete.
14. If repository behavior conflicts with a task prompt, report the conflict before making broad architectural changes.
15. Do not rewrite existing working code merely for style.

## Repository skills

Use the smallest relevant set of skills under `.agents/skills/`.

- `talent-valley-architecture`: architecture, scope, boundaries, structure.
- `talent-valley-backend-api`: ASP.NET REST endpoints, DTOs, services, API behavior.
- `talent-valley-database`: EF Core, SQLite, migrations, indexes, constraints.
- `talent-valley-domain-rules`: approved business rules.
- `talent-valley-auth-security`: Identity, JWT cookie, CSRF, authorization, protected files.
- `talent-valley-frontend-ui`: Next.js UI and approved UX patterns.
- `talent-valley-quality-gate`: validation before completion.

Read only the references needed for the current task.

## Scope discipline

The user's explicit task has priority.

When requirements are already defined in repository instructions or skills, follow them instead of inventing alternatives.

Do not expand the MVP on your own.
