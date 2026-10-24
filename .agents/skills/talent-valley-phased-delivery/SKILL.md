---
name: talent-valley-phased-delivery
description: Use whenever a Talent Valley implementation plan is written or executed. Defines the phase format for plans, one branch per phase (or per PR group) from main, the phase completion report with user approval gate, commit only after approval, push and pull request per phase or per PR group, independent review of each phase report before showing it, brain update and context reset after each phase, and the rule to always ask the user instead of assuming.
---

# Talent Valley Phased Delivery

Use this skill when writing an implementation plan and when executing one.

## 1. Writing a plan

Every implementation plan must be split into phases. For each phase state:

- **Phase N — name**
- **Where** (files/modules/directories to be touched);
- **What** (what will be done there, in concrete terms);
- **Checks** (which quality checks validate the phase).

Rules:
- One phase = one coherent, reviewable unit of change.
- Do not add files, packages or behavior outside the requested scope.
- Show the total phase count at the top of the plan.
- **PR groups.** By default every phase has its own branch and its own pull request. The plan may instead put consecutive phases into a **PR group**: the phases are committed one by one, and a single pull request is opened when the whole group is done. A phase may enter a group only if it is **frontend-only, adds no migration, and does not touch authentication, authorization, roles, the JWT cookie or CSRF**. Any other phase always has its own pull request. The plan shows the groups in the phase table and the user approves them together with the plan; they change only with the user's approval (section 5).
- Once the user approves the plan, save it to the project brain (`plan.md`, format in `talent-valley-project-brain`) and commit and push it to GitHub right away on its own branch `docs/plan-<plan-slug>` created from an up-to-date `origin/main` (never to `main`), including a **Refs** block per phase pointing to the exact files, skills/references and brain entries needed, so each phase can start from a clean context without searching.

## 2. Branch per phase (or per PR group)

Every phase is executed on its own new branch, so all of its changes live there. Phases of the same PR group share one branch: the branch is created at the first phase of the group, and each later phase of the group continues on it.

- Before changing any file in a phase, create the phase branch.
- Every phase branch is created from an up-to-date `main` (`git fetch origin`, then branch from `origin/main`).
- Naming follows the repository convention: `<type>/<scope>-phase-<n>-<short-slug>` (e.g. `feat/recruiter-phase-2-talent-filters`). For a PR group use `<type>/<scope>-phases-<first>-<last>-<short-slug>` (e.g. `feat/ux-aluno-phases-1-3-profile`). Use `feat/`, `fix/`, `refactor/`, `perf/` as appropriate.
- Never commit phase work directly to `main`.
- Confirm the working tree is clean before creating the branch (and before starting each later phase of a group).
- If a phase depends on code from a previous phase that is not yet in `main`, stop and ask the user how to proceed (see section 5). Phases of the same group are the exception: they build on each other on the shared branch. A phase of the next group needs the previous group merged.

## 3. Executing a phase

1. Create the phase branch (first phase of a group: the group branch; later phase of a group: stay on the group branch).
2. Implement only what the phase lists.
3. Run the checks from `talent-valley-quality-gate`.
4. Do not commit or push until the user approves the phase (section 4).

## 4. Phase report and approval gate

Applies to every plan, regardless of the number of phases.

After finishing **each** phase:

1. Generate a **phase completion report** (in the user's language):
   - phase number/name and branch name;
   - what changed;
   - files/modules affected;
   - checks run and their real results (never claim unrun checks);
   - migrations added, if any;
   - unresolved issues or deviations from the plan;
   - the next phase, for context.
2. **Independent review of the report, before showing it to the user.** Spawn a reviewer subagent with a fresh context (model `opus`, per `talent-valley-smart-dispatch`). Give it only: the plan phase (where/what/checks), the draft report, the phase branch name and the base (`origin/main`; for a later phase of a PR group, the commit of the previous phase of the group, and on the last phase of the group also the whole group diff against `origin/main`), so it inspects the real diff and re-runs checks itself. It must verify and return findings per item:
   - **Phase vs plan:** everything the phase lists was done, and nothing outside its scope was changed;
   - **Report vs reality:** every claim in the report (files, checks, results, migrations) matches the actual diff and the real command output;
   - **Project rules:** compliance with `AGENTS.md` and the relevant skills in the affected areas (security, domain, architecture);
   - **Technical correctness:** bugs and risks in the phase's code;
   - **Code quality (SonarQube criteria):** code smells and bad code in the diff, judged by the rules SonarQube applies. See `talent-valley-quality-gate` section 7 for the checklist. List every finding with file and line.

   The reviewer is read-only: it reports findings, it does not edit.
3. **If the review finds problems (including code smells),** fix them on the same phase branch, re-run the checks, update the report and run the review again. Repeat until it passes. Only then show the report to the user, including the review outcome (what was checked, problems found and how they were fixed). If a problem cannot be fixed within the phase scope, or fixing it needs a decision, ask the user (section 5) instead of deciding alone.
4. **Stop and wait for explicit user approval.** Do not start the next phase, create its branch, commit or push before approval.
5. On approval:
   - commit the phase on its branch (Conventional Commits, matching repository history);
   - **if the phase is not the last of its PR group:** stop the publishing here. Do not push and do not open a pull request yet; the next phase continues on the same branch. Mark the phase `aprovada` in the brain with its commit hash and the note "PR do grupo pendente", then go to the brain update and the context reset below;
   - `git push -u origin <phase-branch>` (for the last phase of a group, the group branch, which carries all of its commits);
   - confirm the push succeeded;
   - **SonarQube verification on the PR** (second quality layer): follow `talent-valley-quality-gate` section 8. Open the PR to `main` (if the PR cannot be opened from the CLI, ask the user to open it and wait), wait for the SonarQube Cloud analysis, and read the real issues. Every issue must be fixed on the same phase branch, pushed, and re-checked until the PR has no open issues. If an issue cannot be fixed within the phase scope, is a suspected false positive, or fixing it needs a decision or changes behavior, ask the user (section 5) instead of deciding alone. Never merge or close issues on your own;
   - update the project brain (`talent-valley-project-brain`): save the approved report (with the SonarQube outcome: issues found and how they were fixed) to `reports/phase-<n>.md`, save every problem solved in the phase to `solved/` and `INDEX.md`, mark the phase `aprovada` with its commit hash in `plan.md`, and refresh the resume prompt for the next phase. `plans/` is versioned: commit these plan and report changes (`docs: update plan <plan-slug>`) on the same phase branch and push it. `solved/` and the rest of the brain stay local: do not commit or push them.
6. **Context reset.** After the brain is updated, stop. Do not start the next phase in the same context. Tell the user the phase is closed and that they should run `/clear` (the agent cannot run it), and give the resume prompt from `plan.md`. The next session starts from zero and follows the resume protocol in `talent-valley-project-brain`, using the saved plan.
   - After the last phase, mark the plan `concluido` instead and give no resume prompt.
7. If the user requests changes instead, fix them on the **same** phase branch (the group branch, for a group), re-run checks, run the independent review again, and send an updated report. Do not create a new branch for the same phase.

## 5. Doubts — always ask

Applies while planning and while executing.

- Whenever something is unclear, ambiguous or undefined (scope, behavior, naming, phase split, dependencies between phases, business rule, UX, trade-offs), **ask the user and wait for the answer**.
- Never infer, assume or deduce. Do not choose a "sensible default" on the user's behalf and do not proceed with a stated assumption.
- Ask before writing the plan if the doubt affects it; ask mid-phase if it appears during execution, and stop work on the affected part until answered.
- Prefer the `AskUserQuestion` tool; keep questions specific and, when useful, list the options with a recommendation, but the decision is always the user's.
- Always write questions, answers and messages to the user in Brazilian Portuguese (pt-BR), including question text and option labels.
- Do not ask about things already defined in `AGENTS.md`, the skills, or the user's request.

## 6. Hard limits

- Never push to `main`; never force-push.
- Never commit or push without the approval described above.
- Approval of one phase does not authorize the next phase's commit/push. In a PR group, the push and the pull request happen only after the last phase of the group is approved.
- If a phase turns out to need changes outside the plan, stop and report before proceeding (see AGENTS.md rule 14).
