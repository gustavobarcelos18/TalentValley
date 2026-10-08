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

When executing a phased plan, this report is the basis of the phase completion report. Approval, commit and push rules are in `talent-valley-phased-delivery`.

## 7. Code quality review (SonarQube criteria, before the PR)

SonarQube only sees code that was pushed, so before approval the reviewer applies its criteria by hand to the changed files. Report every finding with file and line; all of them must be fixed.

- cognitive complexity and deep nesting; functions or components that are too long or take too many parameters;
- duplicated code and duplicated string literals;
- dead code: unused variables, imports, parameters, private members, unreachable branches, commented-out code;
- empty or swallowed catch blocks, ignored return values, unobserved async calls (`async void`, floating promises);
- C#: unused usings, magic numbers, mutable public state, missing disposal of `IDisposable`, string concatenation in loops;
- TypeScript/React: `any`, non-null assertions without need, array index as `key`, missing hook dependencies, nested ternaries, leftover `console.log`;
- hardcoded credentials, URLs or secrets; weak or unsafe patterns that Sonar flags as vulnerabilities or security hotspots.

Do not "fix" findings by suppressing them (`#pragma warning disable`, `// NOSONAR`, `eslint-disable`) without asking the user.

## 8. SonarQube Cloud verification (after push, on the PR)

The Sonar project is public: `gustavobarcelos18_TalentValley` in organization `gustavobarcelos18`. Reads need no token. Never put the `SONAR_TOKEN` in files or chat.

1. Wait until the `SonarQube Cloud` workflow of the PR has finished (GitHub Actions). If it failed to run, report that instead of assuming the code is clean.
2. Read the results for the PR number `<N>`:
   - quality gate: `https://sonarcloud.io/api/qualitygates/project_status?projectKey=gustavobarcelos18_TalentValley&pullRequest=<N>`
   - issues (code smells, bugs, vulnerabilities): `https://sonarcloud.io/api/issues/search?componentKeys=gustavobarcelos18_TalentValley&pullRequest=<N>&resolved=false&ps=500`
   - security hotspots: `https://sonarcloud.io/api/hotspots/search?projectKey=gustavobarcelos18_TalentValley&pullRequest=<N>`
3. Fix every open issue and hotspot on the phase branch, run the checks from sections 2 and 3, push, and read again. Repeat until the PR has no open issues.
4. Report the outcome in the phase report: how many issues were found, which rules, and how each was fixed. Never claim the PR is clean without having read the API result.
