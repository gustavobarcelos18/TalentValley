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

Collaborators follow the complete process: `talent-valley-phased-delivery`, `talent-valley-quality-gate` and `talent-valley-project-brain`. Read `talent-valley-contribution-workflow` before starting: it has the branch names for phased plans, the one-migration-per-pull-request protocol, and how to do the independent review when your tool has no subagents. Only the maintainer merges.

## Checks before saying a task is done

Follow `talent-valley-quality-gate`. Run on the local machine only the checks that apply to the files you changed, and report the real result. The full suite is run by CI on every push and pull request (see below), so do not repeat it locally.

- Backend changed: `dotnet build backend/TalentValley.slnx` and `dotnet test backend/TalentValley.slnx --filter <tests of the changed area>`. The full `dotnet test` stays in CI.
- Database model changed (entities in `backend/TalentValley.Api/Domain/Entities`, `backend/TalentValley.Api/Data/Configurations`, or `backend/TalentValley.Api/Data/AppDbContext.cs`): from the repository root, with `ASPNETCORE_ENVIRONMENT=Development` set (PowerShell: `$env:ASPNETCORE_ENVIRONMENT = 'Development'`; bash: `export ASPNETCORE_ENVIRONMENT=Development`), run:

  ```
  dotnet tool restore
  dotnet ef migrations add <MigrationName> --project backend/TalentValley.Api --output-dir Data/Migrations
  dotnet ef migrations has-pending-model-changes --project backend/TalentValley.Api
  ```

  The last command must report no pending changes.
- Frontend changed (inside `frontend/`): `npx eslint <changed files>`, `npm run typecheck` and `npx vitest run <tests of the changed files>`. Run `npm ci` (never `npm install`, which can rewrite the lockfile) only when `node_modules` is missing or `package.json`/`package-lock.json` changed. `npm run build`, the full `npm test` and the dependency audit stay in CI.
- Always run the full local suite (the complete commands above, `npm ci` and `npm run build` included) when the change touches shared code used across the app (theme, layout, API client, validation shared by several screens), authentication/security, or when the person asks for it.

CI runs the full checks (build, all tests, lint, typecheck, migrations, dependency audits, Docker build) on every push and pull request. In the final report, say plainly which checks ran locally and that the rest is confirmed by CI. A failing check, local or in CI, must be fixed, not bypassed. If a command fails and you cannot find the cause, stop, show the real error to the person and ask. Do not try random fixes.

## Repository skills

Use the smallest relevant set of skills under `.agents/skills/`.

Quick guide — which skills to read for each kind of task:

| Task | Read |
| --- | --- |
| New or changed screen, component, theme, animation | `talent-valley-frontend-ui` (+ `frontend/AGENTS.md`) |
| New or changed API endpoint, DTO, service | `talent-valley-backend-api` + `talent-valley-domain-rules` |
| New or changed entity, table, index, migration | `talent-valley-database` |
| Login, roles, JWT cookie, CSRF, protected files | `talent-valley-auth-security` (maintainer decides, see above) |
| Business rule or "what is allowed" question | `talent-valley-domain-rules` |
| Folder structure, scope or boundary doubt | `talent-valley-architecture` |
| Any task before saying it is done | `talent-valley-quality-gate` |
| Phased plan, phase report, resume after context reset | `talent-valley-phased-delivery` + `talent-valley-project-brain` |
| Branch, commit, migration order, pull request | `talent-valley-contribution-workflow` |
| Delegating work to subagents | `talent-valley-smart-dispatch` |

Claude Code loads skills from `.claude/skills/`, which is a copy of `.agents/skills/`. `.agents/skills/` is the source of truth: after editing a skill there, copy it to `.claude/skills/` in the same pull request.

- `talent-valley-architecture`: architecture, scope, boundaries, structure.
- `talent-valley-backend-api`: ASP.NET REST endpoints, DTOs, services, API behavior.
- `talent-valley-database`: EF Core, SQLite, migrations, indexes, constraints.
- `talent-valley-domain-rules`: approved business rules.
- `talent-valley-auth-security`: Identity, JWT cookie, CSRF, authorization, protected files.
- `talent-valley-frontend-ui`: Next.js UI and approved UX patterns.
- `talent-valley-quality-gate`: validation before completion.
- `talent-valley-smart-dispatch`: model choice (opus/sonnet/haiku) when delegating to subagents.
- `talent-valley-phased-delivery`: phased plans, branch per phase, phase reports, approval, commit/push.
- `talent-valley-project-brain`: `.agents/brain/` (plans are versioned on GitHub; solved problems and drafts stay local) and resume after context reset.
- `talent-valley-contribution-workflow`: branch names, one migration per pull request, pull request rules, full process for collaborators, independent review when the tool has no subagents.

Read only the references needed for the current task.

If your tool does not load skills automatically, open `.agents/skills/<skill-name>/SKILL.md` and read it yourself before working in that area.

Model choice (details in `talent-valley-smart-dispatch`): use the cheapest model that can do the task correctly, and do not start a subagent for work that is faster to do directly.

- `opus`: architecture, authentication/authorization, domain rules, database design and migrations, and the final review.
- `sonnet`: normal implementation (controllers, services, pages, components), integration and debugging.
- `haiku`: mechanical work (copy/label changes, simple tests, searching files, running checks and summarizing the output).
- Security, authorization and domain-rule enforcement never go below `sonnet`. When unsure between two levels, pick the higher one.

Before writing any frontend code, read `frontend/AGENTS.md`. The Next.js version in this repository has breaking changes; its docs are in `frontend/node_modules/next/dist/docs/` after `npm ci`.

## Scope discipline

The user's explicit task has priority.

When requirements are already defined in repository instructions or skills, follow them instead of inventing alternatives.

Do not expand the MVP on your own.
