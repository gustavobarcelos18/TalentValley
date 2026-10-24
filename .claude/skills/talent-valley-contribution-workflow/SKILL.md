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
| PR group (several phases, one pull request) | `<type>/<scope>-phases-<first>-<last>-<short-slug>` | `feat/ux-aluno-phases-1-3-profile` |

Each phase of a plan has its own branch, created from an up-to-date `origin/main` (`talent-valley-phased-delivery` section 2). The phases of a PR group share one branch. Only frontend-only phases with no migration and no authentication change may be grouped, and only when the approved plan says so. If a phase needs code from a previous phase that is not in `main` yet, stop and ask (phases of the same group are the exception).

## 3. Database migrations (one per pull request)

Applies when entities, configurations or `AppDbContext` change. **Read `references/migrations.md` before touching a migration.** It holds the one-migration-per-PR protocol, how to bring the branch up to date, and what to do when another PR with a migration reaches `main` first. The rules of `talent-valley-database` still apply. Warn the person clearly that the change touches the database.

## 4. Doing the change

Follow `talent-valley-phased-delivery` section 3: implement only what the phase lists, run the checks from `talent-valley-quality-gate`, and do not commit before the person approves the phase report.

Do not touch the areas listed in `AGENTS.md` under "Ask the maintainer first" unless the conversation states the person is the maintainer. Continue with the rest of the task only if it does not depend on that change, and tell the person to ask the maintainer about that part.

## 5. Independent review of the phase report

The review must be done by a reader that did **not** write the change, with a fresh context, so it can inspect the real changes and re-run the checks itself.

- **If your tool can spawn subagents:** follow `talent-valley-phased-delivery` section 4 step 2 as written, including the model choice from `talent-valley-smart-dispatch`.
- **If your tool cannot spawn subagents:** tell the person to open a **new, clean conversation** in an AI tool that can read files and run commands inside this same repository folder (the same tool or another one; a chat that cannot see the folder cannot review). Give the person the review request below. Never review your own work in the same conversation and call it independent. For model choice, use the strongest model the tool offers.

The review happens before the commit, so the changes are in the working tree: use `git diff $(git merge-base HEAD origin/main)` and read new files directly.

The person must not approve the phase until this review has passed.

The review request to give the person is in `references/independent-review.md`. Fill its values (`<branch>`, `<where / what / checks>`, `<report>`).

Then fix every finding on the same branch, re-run the checks, and ask for the review again until it passes. Put the review outcome in the report you show to the person (what was checked, problems found, how they were fixed).

## 6. Publishing

After the person approves the phase report (`talent-valley-phased-delivery` section 4 step 5):

1. Commit on the phase branch using Conventional Commits (`feat: ...`, `fix: ...`, `docs: ...`), matching the repository history. Add only the files of the phase. In a PR group, commit each phase after its approval, but do steps 2 to 6 only after the **last** phase of the group is approved.
2. `git push -u origin <branch>`. Never push to `main`.
3. Open a pull request **to `main`**. If the tool cannot open it, give the person the branch name and ask them to open it on GitHub, then wait.
4. The pull request description states: what changed and why, which files, which migration (if any), and which checks ran with their real results.
5. Wait for CI and the SonarQube Cloud analysis and handle every issue as described in `talent-valley-quality-gate` section 8, fixing on the same branch. If the pull request shows a conflict on the model snapshot, or CI fails on `has-pending-model-changes`, follow `references/migrations.md` step 6.
6. Tell the person the pull request is ready for the maintainer. **Merging is the maintainer's decision.**

## 7. Closing the phase

Update the project brain as described in `talent-valley-project-brain` and `talent-valley-phased-delivery` section 4 steps 5 and 6, then stop. Do not start the next phase in the same context.
