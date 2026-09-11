---
name: talent-valley-database
description: Use when changing Talent Valley EF Core entities, DbContext, entity configurations, SQLite schema, migrations, constraints, indexes, seed data, or query persistence behavior.
---

# Talent Valley Database

## Required approach

1. Use EF Core migrations. Do not hand-create application tables.
2. Use SQLite for the MVP.
3. Enable WAL, foreign keys, and `synchronous=NORMAL`.
4. Use `IEntityTypeConfiguration<T>` for entity configuration.
5. Persist enums as strings.
6. Use `DateOnly` for calendar dates and `DateTimeOffset` for timestamps.
7. Never store uploaded file bytes as BLOBs; store storage keys.
8. Enforce structural integrity in both database constraints and service logic where appropriate.
9. Add indexes only for known access/search patterns.
10. Never edit or regenerate old migrations casually. Create a new migration for schema changes.

Read `references/schema-rules.md` before entity or migration work.
