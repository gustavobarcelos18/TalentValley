---
name: talent-valley-project-brain
description: Use when an implementation plan is in progress (a plan.md with status em-andamento exists under .agents/brain/plans/), when saving a plan, phase report or solved problem, and when resuming after a context reset. Defines the local project brain folder, its formats, and the resume protocol.
---

# Talent Valley Project Brain

The project brain is the `.agents/brain/` folder. It keeps what must survive a context reset, so a fresh session can continue a plan without searching.

**Every plan is versioned on GitHub.** Everything under `.agents/brain/plans/` (each `plan.md` and its `reports/`) is committed and pushed, never left only on one machine. The rest of the brain (`solved/`, drafts, samples) is local-only: it is ignored by `.gitignore` and must never be committed or pushed. Because plans go to GitHub, never write real personal data, secrets, local user paths or sample files in them.

Write brain files in the user's language.

## 1. Layout

```
.agents/brain/
  plans/<plan-slug>/
    plan.md               # the plan, phase status, refs per phase, resume prompt
    reports/phase-<n>.md  # approved completion report of each phase
  solved/
    INDEX.md              # one line per solved problem: title -> file
    <slug>.md             # one file per solved problem
```

Create folders/files on demand. Never store secrets, tokens, passwords or personal data in the brain.

## 2. plan.md

Must contain, in this order:

1. **Header:** title, `status: em-andamento | concluido`, date, total phases.
2. **Phase table:** phase, name, branch, PR group (only when phases share one pull request; phases of a group show the same branch), status (`pendente | em-execucao | aprovada`), commit hash (when approved). In a PR group, a phase approved before the group's pull request is open is marked `aprovada (PR do grupo pendente)`.
3. **Per phase** (format from `talent-valley-phased-delivery`: where / what / checks) plus a **Refs** block with direct pointers so the executor goes straight to the solution without searching:
   - source files to open, with the relevant function/section or line range;
   - skills to load (smallest set) and the exact reference files inside them;
   - `solved/` entries relevant to this phase;
   - previous phase reports to read, if any.
4. **Resume prompt:** the exact short prompt the user pastes after `/clear` (e.g. `Retomar o plano <plan-slug> na fase <n>`), kept up to date.

Refs must be specific paths, not generic advice. If a ref is unknown at planning time, mark it `a descobrir` and fill it in once known.

## 3. Phase report (`reports/phase-<n>.md`)

Save the completion report shown to the user, after it is approved: what changed, files affected, checks run and real results, migrations, unresolved issues, the independent review outcome (problems found and how they were fixed), branch and commit hash.

## 4. Solved problems (`solved/`)

Save every problem that was solved, as one short file:

- **Problema:** symptom / error message.
- **Causa:** root cause.
- **Solução:** what fixed it.
- **Arquivos:** paths touched.
- **Fase/plano:** where it happened.

Add one line to `solved/INDEX.md`. Before investigating a new problem, check `INDEX.md` first.

## 5. Resume protocol (start of a fresh session)

Applies only when a plan with `status: em-andamento` exists, or the user asks to resume one.

1. Read only that `plan.md`.
2. Find the next phase not `aprovada`.
3. Read only that phase's **Refs** (files, skills, solved entries, previous reports). Do not scan the repository or the whole brain.
4. Confirm the phase branch/base state with `git status` and `git branch`, then proceed per `talent-valley-phased-delivery`.
5. If the plan or refs are unclear or contradict the repository, ask the user (AGENTS.md rule 16).

Tasks with no plan in progress do not load the brain.
