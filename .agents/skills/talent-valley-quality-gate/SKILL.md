---
name: talent-valley-quality-gate
description: Use before declaring any Talent Valley coding task complete. Verifies scope, build, tests, lint/type safety, migrations, security-sensitive behavior, and that unrelated files were not changed.
---

# Talent Valley Quality Gate

Use this skill at the end of every implementation task.

## 1. Scope review

- Inspect `git diff` / changed files.
- Confirm every changed file is necessary for the requested task.
- Revert unrelated formatting/refactors.
- Confirm no unrequested feature or dependency was added.

## 2. Backend validation

When backend exists and is affected:
- restore/build using repository commands;
- run relevant tests;
- verify warnings/errors introduced by the change;
- if EF schema changed, ensure a new migration exists and applies cleanly;
- do not rewrite old migrations without explicit need.

## 3. Frontend validation

When frontend exists and is affected:
- use the repository's package manager;
- run relevant lint;
- run type checking if configured;
- run tests if configured;
- run production build when practical for the task.

Do not invent package-manager commands if the repository already defines scripts.

## 4. Business-rule validation

For affected behavior, explicitly verify critical domain cases.

Examples:
- third project rejected;
- verified RPV formation edit resets to pending;
- blocked recruiter denied;
- student cannot edit another student;
- compare requires exactly two students.

## 5. Security review

For auth/security/file changes:
- no secrets committed;
- no JWT/localStorage regression;
- no authorization enforced only in UI;
- no public CV/certificate path;
- no sensitive values logged.

## 6. Completion report

Report:
- what changed;
- files/modules affected;
- commands/checks run;
- test/build result;
- migrations added, if any;
- any unresolved issue.

Do not claim success for checks that were not actually run.
