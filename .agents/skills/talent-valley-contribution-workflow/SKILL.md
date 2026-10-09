---
name: talent-valley-contribution-workflow
description: Use whenever you start, continue or publish a change to the Talent Valley repository, especially when the person you help is a collaborator (not the maintainer). Defines branch names, the one-migration-per-PR protocol, pull request rules, the independent review when the AI tool has no subagents, and that the AI never merges or pushes to main.
---

# Talent Valley Contribution Workflow

This skill holds the details of how a change travels from idea to pull request. `AGENTS.md` has the short version. It applies to every AI tool and every contributor. Where this skill only points to another skill, follow that skill.

Always answer the person in Brazilian Portuguese (pt-BR), in plain words (see `AGENTS.md`, "Who you are helping").

## 1. Who does what

- The **collaborator** asks the AI for a change, reads the plain-language report and approves each phase.
- The **AI** prepares the branch, the change, the checks, the commit, the push and, when the tool allows it, the pull request, following section 6.
- The **maintainer** (project owner) is the only one who merges a pull request into `main`.

The AI never merges a pull request, never pushes to `main` and never force-pushes (`AGENTS.md`, "Never do"). If the person asks for any of these, refuse and explain that it is not allowed. Merging is done only by the maintainer. Never merge or close SonarQube issues on your own; fix them in code or ask (`talent-valley-phased-delivery` section 4 step 5).

Collaborators follow the **complete** process: `talent-valley-phased-delivery` (phases, report, approval gate), `talent-valley-quality-gate` (checks and SonarQube) and `talent-valley-project-brain` (plan, reports, resume). This always applies, even to a small change: every change by a collaborator is a plan, and a small one is a plan with a single phase, with its `plan.md`, phase report, independent review and approval.

Collaborators have write access to the repository and push their own branch to `origin` (never to `main`); they do not work in forks.

## 2. Start of any change

1. `git status`. If there are uncommitted changes you did not make for this task, stop and ask.
2. `git fetch origin`.
3. Create the branch from `origin/main`, never from another feature branch. Never work on `main`.
4. One branch = one task. If the task grows beyond what was asked, stop and ask (`AGENTS.md` rule 16).

### Branch names

Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `ci`. Lowercase, words separated by hyphens.

| Situation | Format | Example |
|---|---|---|
| Plan with a single phase | `<type>/<short-description>` | `feat/talent-filter-by-city` |
| Plan split into phases | `<type>/<scope>-phase-<n>-<short-slug>` | `feat/recruiter-phase-2-talent-filters` |

Each phase of a plan has its own branch, created from an up-to-date `origin/main` (`talent-valley-phased-delivery` section 2). If a phase needs code from a previous phase that is not in `main` yet, stop and ask.

## 3. Database migrations (one per pull request)

Applies when entities, configurations or `AppDbContext` change. The rules of `talent-valley-database` still apply. Warn the person clearly that the change touches the database.

1. A pull request adds **at most one** new migration.
2. Bring the branch up to date with `origin/main` so you see every migration already merged by others. Do it at the start of the phase, **before** editing anything, while the working tree is clean: `git fetch origin`, then `git rebase origin/main` if the branch was never pushed, or `git merge origin/main` if it was already pushed (check with `git ls-remote --heads origin <branch>`; empty output means never pushed). Never force-push to make a rebase work. A merge creates a commit: ask the person to approve it first. If the working tree is not clean when you need this step, stop and ask the person; do not commit, stash or discard changes on your own.
3. Generate the migration with the commands in `AGENTS.md` ("Checks before saying a task is done"), with `ASPNETCORE_ENVIRONMENT=Development`. `dotnet ef migrations has-pending-model-changes` must report no pending changes. If the model changes again after you generated the migration, do not add a second one: remove yours as in step 6 (items 2 and 3) and generate it again.
4. Never edit, rename, delete or regenerate a migration that is already in `origin/main`, unless the maintainer decides it (`AGENTS.md`, "Ask the maintainer first"). To see which migrations are in `main`: `git ls-tree --name-only origin/main backend/TalentValley.Api/Data/Migrations/`.
5. Never edit the model snapshot by hand. Only the EF tool changes it.
6. **If another pull request with a migration reaches `main` after you generated yours** (updating your branch conflicts on the snapshot), do not resolve the conflict by hand. If the update works without a conflict, still re-run `dotnet build backend/TalentValley.slnx` and `dotnet ef migrations has-pending-model-changes`. If the latter reports changes, do not undo the update (no `git reset`); skip item 1 below and follow items 2 to 4 only when the newest migration is yours and is not in `origin/main`; otherwise stop and show the real output to the person. These are the items:
   1. When there is a conflict, cancel the update: `git rebase --abort` or `git merge --abort`.
   2. List the migrations of your branch (`ls backend/TalentValley.Api/Data/Migrations/`) and check, with the command in step 4, that the newest one by timestamp is yours and is **not** in `origin/main`. `dotnet ef migrations remove` always removes the newest one, so removing a migration that is in `main` would break rule 4.
   3. From the repository root, with `ASPNETCORE_ENVIRONMENT=Development`, run `dotnet tool restore` and `dotnet ef migrations remove --project backend/TalentValley.Api`. If it fails (for example because the migration was applied to your local database), stop and show the real error to the person.
   4. Ask the person to approve a commit of the removal, update the branch with `origin/main` as in step 2, and generate the migration again (step 3).

   If anything is unclear, stop and ask.

## 4. Doing the change

Follow `talent-valley-phased-delivery` section 3: implement only what the phase lists, run the checks from `talent-valley-quality-gate`, and do not commit before the person approves the phase report.

Do not touch the areas listed in `AGENTS.md` under "Ask the maintainer first" unless the conversation states the person is the maintainer. Continue with the rest of the task only if it does not depend on that change, and tell the person to ask the maintainer about that part.

## 5. Independent review of the phase report

The review must be done by a reader that did **not** write the change, with a fresh context, so it can inspect the real changes and re-run the checks itself.

- **If your tool can spawn subagents:** follow `talent-valley-phased-delivery` section 4 step 2 as written, including the model choice from `talent-valley-smart-dispatch`.
- **If your tool cannot spawn subagents:** tell the person to open a **new, clean conversation** in an AI tool that can read files and run commands inside this same repository folder (the same tool or another one; a chat that cannot see the folder cannot review). Give the person the review request below. Never review your own work in the same conversation and call it independent. For model choice, use the strongest model the tool offers.

The review happens before the commit, so the changes are in the working tree: use `git diff $(git merge-base HEAD origin/main)` and read new files directly.

The person must not approve the phase until this review has passed.

Review request to give the person (fill the values):

> Review a Talent Valley change that is not committed yet. Read `AGENTS.md` first (the section "Working on a change" does not apply to you, you are only a reviewer), then `.agents/skills/talent-valley-quality-gate/SKILL.md`. Branch: `<branch>`, base: `origin/main`. Do not edit, commit, stash, fetch, checkout or create branches; only report. Run `git status` and `git diff $(git merge-base HEAD origin/main)` to see the changes, and read every new (untracked) file directly. Re-run the checks from `AGENTS.md` yourself, but for the database only run `dotnet tool restore` and then `dotnet ef migrations has-pending-model-changes` with `ASPNETCORE_ENVIRONMENT=Development`; never run `dotnet ef migrations add` or `remove`. Planned phase: `<where / what / checks>`. Draft report: `<report>`. Answer in pt-BR, with file and line for each finding: (1) was everything in the phase done and nothing outside its scope changed; (2) does every claim in the report match the changes and the real command output; (3) is the change compliant with `AGENTS.md` and the relevant skills; (4) bugs and risks; (5) code quality by SonarQube criteria (`talent-valley-quality-gate` section 7).

Then fix every finding on the same branch, re-run the checks, and ask for the review again until it passes. Put the review outcome in the report you show to the person (what was checked, problems found, how they were fixed).

## 6. Publishing

After the person approves the phase report (`talent-valley-phased-delivery` section 4 step 5):

1. Commit on the phase branch using Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`), matching the repository history. Add only the files of the phase.
2. `git push -u origin <branch>`. Never push to `main`.
3. Open a pull request **to `main`**. If the tool cannot open it, give the person the branch name and ask them to open it on GitHub, then wait.
4. The pull request description states: what changed and why, which files, which migration (if any), and which checks ran with their real results.
5. Wait for CI and the SonarQube Cloud analysis and handle every issue as described in `talent-valley-quality-gate` section 8, fixing on the same branch. If the pull request shows a conflict on the model snapshot, or CI fails on `has-pending-model-changes`, follow section 3 step 6.
6. Tell the person the pull request is ready for the maintainer. **Merging is the maintainer's decision.**

## 7. Closing the phase

Update the project brain as described in `talent-valley-project-brain` and `talent-valley-phased-delivery` section 4 steps 5 and 6, then stop. Do not start the next phase in the same context.
