---
name: talent-valley-domain-rules
description: Use for any Talent Valley feature that changes student, recruiter, formation, experience, project, search, favorites, comparison, admin, RPV validation, or audit business behavior.
---

# Talent Valley Domain Rules

This skill is the source of truth for approved MVP business behavior.

Before modifying domain behavior, read `references/mvp-rules.md`.

## Enforcement principles

- Enforce critical rules in backend code even when the UI also prevents invalid actions.
- Do not silently add new business states or flows.
- If a requested change conflicts with the approved rules, call out the conflict.
- Update `Aluno.AtualizadoEm` after meaningful student-profile changes.
- Keep admin actions auditable where specified.
