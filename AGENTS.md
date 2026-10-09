# Talent Valley — Repository Agent Guide

Talent Valley is the career platform for Rio Pomba Valley.

Read this whole file before changing anything. It applies to every AI tool and to every contributor, including people who do not know web development.

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
16. Whenever there is any doubt, ask the user and wait for the answer. Never infer, assume or deduce missing requirements, behavior, scope or decisions.
17. Always answer and ask the user questions in Brazilian Portuguese (pt-BR).

## Who you are helping

The person you assist may not know web development and may not be able to review code. Because of that:

- Explain what you changed and why in plain Brazilian Portuguese, without unexplained jargon.
- List every file you created, edited or deleted.
- Warn clearly when a change is risky (security, login, data, deletion, database).
- Do only what was asked. If the request is vague, or would touch more than it names, ask first (rule 16).
- Never say a check passed unless you ran it and saw it pass. If you could not run it, say so.

## Never do (nobody can approve these)

- Push to `main`, force-push, or merge a pull request. Only the maintainer merges.
- Commit secrets: `.env` files, tokens, passwords, signing keys, or real personal data of students or recruiters.
- Delete, skip or disable tests, loosen lint rules, or remove CI steps, to make a check pass. Fix the cause instead. (Suppressing a code-quality finding is covered by `talent-valley-quality-gate`.)

## Ask the maintainer first

The maintainer is the project owner. These changes need the maintainer's decision, not only the agreement of the person you are helping. Unless the conversation states that the person is the maintainer, assume they are not: stop that part of the task, explain why, and tell the person to ask the maintainer. Continue with the rest of the task only if it does not depend on that change.

- Add, remove or upgrade a package or dependency (`*.csproj`, `package.json`, lockfiles).
- Edit or regenerate an EF Core migration that is already in `origin/main`. Schema changes always go in a new migration; the model snapshot is updated by the EF tool, never by hand.
- Change authentication, authorization, roles, the JWT cookie or CSRF behavior.
- Change `.github/` (CI) or deployment configuration.

## Working on a change

1. Run `git status`. If there are uncommitted changes you did not make for this task, stop and ask.
2. Run `git fetch origin` and create a new branch from `origin/main`. Never work directly on `main`.
3. Name the branch `<type>/<short-description>`, where type is `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore` or `ci` (example: `feat/talent-filter-by-city`). One branch, one task.
4. Commit only when the person asks. Commit messages follow Conventional Commits (`feat: ...`, `fix: ...`), matching the repository history. When executing a phased plan, follow `talent-valley-phased-delivery` for commit and approval rules.
5. When the person asks you to publish the work, push the branch (never `main`) and open a pull request to `main`.
6. In the pull request, state what changed and why, which files, and which checks you ran with their real results.

## Checks before saying a task is done

Follow `talent-valley-quality-gate`, and run what applies to the files you changed, reporting the real result:

- Backend: `dotnet build backend/TalentValley.slnx` and `dotnet test backend/TalentValley.slnx`.
- Database model changed (entities in `backend/TalentValley.Api/Domain/Entities`, `backend/TalentValley.Api/Data/Configurations`, or `backend/TalentValley.Api/Data/AppDbContext.cs`): from the repository root, with `ASPNETCORE_ENVIRONMENT=Development` set (PowerShell: `$env:ASPNETCORE_ENVIRONMENT = 'Development'`; bash: `export ASPNETCORE_ENVIRONMENT=Development`), run:

  ```
  dotnet tool restore
  dotnet ef migrations add <MigrationName> --project backend/TalentValley.Api --output-dir Data/Migrations
  dotnet ef migrations has-pending-model-changes --project backend/TalentValley.Api
  ```

  The last command must report no pending changes.
- Frontend (inside `frontend/`): run `npm ci` first (not `npm install`, which can rewrite the lockfile), then `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`.

CI runs these checks, plus dependency audits and a Docker build, on every push and pull request. A failing check must be fixed, not bypassed. If a command fails and you cannot find the cause, stop, show the real error to the person and ask. Do not try random fixes.

## Repository skills

Use the smallest relevant set of skills under `.agents/skills/`.

- `talent-valley-architecture`: architecture, scope, boundaries, structure.
- `talent-valley-backend-api`: ASP.NET REST endpoints, DTOs, services, API behavior.
- `talent-valley-database`: EF Core, SQLite, migrations, indexes, constraints.
- `talent-valley-domain-rules`: approved business rules.
- `talent-valley-auth-security`: Identity, JWT cookie, CSRF, authorization, protected files.
- `talent-valley-frontend-ui`: Next.js UI and approved UX patterns.
- `talent-valley-quality-gate`: validation before completion.
- `talent-valley-smart-dispatch`: model choice (opus/sonnet/haiku) when delegating to subagents.
- `talent-valley-phased-delivery`: phased plans, branch per phase, phase reports, approval, commit/push.
- `talent-valley-project-brain`: local `.agents/brain/` (plans, phase reports, solved problems) and resume after context reset.

Read only the references needed for the current task.

If your tool does not load skills automatically, open `.agents/skills/<skill-name>/SKILL.md` and read it yourself before working in that area.

Before writing any frontend code, read `frontend/AGENTS.md`. The Next.js version in this repository has breaking changes; its docs are in `frontend/node_modules/next/dist/docs/` after `npm ci`.

## Scope discipline

The user's explicit task has priority.

When requirements are already defined in repository instructions or skills, follow them instead of inventing alternatives.

Do not expand the MVP on your own.
