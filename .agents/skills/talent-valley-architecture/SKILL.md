---
name: talent-valley-architecture
description: Use for Talent Valley architecture, project structure, dependencies, module boundaries, technical planning, or MVP scope decisions. Enforces the approved stack and prevents feature creep.
---

# Talent Valley Architecture

Use this skill when planning or changing architectural structure.

## Workflow

1. Read `references/approved-architecture.md` only if the task affects architecture or scope.
2. Inspect the existing repository before proposing structural changes.
3. Preserve the approved stack and module boundaries.
4. Prefer the smallest change that satisfies the task.
5. Reject speculative abstractions and future-only infrastructure.
6. Keep controllers thin, business rules in services, persistence in EF Core configuration/repositories only where genuinely useful.
7. Keep the MVP as one ASP.NET Core API project and one Next.js frontend unless the task explicitly changes this.
8. Never turn Talent Valley into an ATS, job board, interview pipeline, or messaging platform.

## Output expectations

When architecture changes are requested:
- state the files/directories affected;
- explain any new dependency;
- identify migration or security impact;
- preserve backward-compatible behavior where practical.
