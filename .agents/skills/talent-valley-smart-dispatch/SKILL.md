---
name: talent-valley-smart-dispatch
description: Use when delegating Talent Valley work to subagents or choosing a model. Routes tasks to opus, sonnet or haiku by complexity to save tokens without lowering quality on security, domain or architecture work.
---

# Talent Valley Smart Dispatch

Pick the cheapest model that can do the task correctly. Set it with the `model` parameter when spawning a subagent. Do not spawn a subagent for work that is faster to do inline.

## opus — reasoning and risk

- Architecture decisions and scope/conflict analysis.
- Authentication, authorization, JWT cookie, CSRF and protected-file work.
- Domain-rule interpretation and business logic with several rules interacting.
- EF Core schema design, migrations, constraints and indexes.
- Final review before declaring a task complete.

## sonnet — standard implementation

- ASP.NET controllers, services and DTOs with explicit mapping.
- Next.js pages and React components with logic or data fetching.
- Integration between frontend and API.
- Debugging failing tests or builds.

## haiku — mechanical tasks

- Boilerplate DTOs, constants and simple test fixtures.
- Unit tests for already-defined behavior.
- Text, labels and copy changes inside approved UX.
- Searching files, listing usages, reading logs.
- Running build/test/lint commands and summarizing output.

## Rules

- Security, authorization and domain-rule enforcement never go below sonnet, and the final review stays on opus. These rules are never enforced by the frontend alone.
- When unsure between two levels, pick the higher one.
- The task's scope is unchanged by the model chosen. Follow `AGENTS.md` and `talent-valley-quality-gate` regardless.
