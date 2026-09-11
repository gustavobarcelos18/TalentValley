---
name: talent-valley-backend-api
description: Use when implementing or modifying Talent Valley ASP.NET Core REST controllers, DTOs, services, response models, validation, pagination, search endpoints, or API error behavior.
---

# Talent Valley Backend API

## Required approach

1. Inspect existing controllers, DTOs, services, and conventions before editing.
2. Use explicit request/response DTOs.
3. Never return EF entities directly.
4. Keep controllers focused on HTTP concerns.
5. Put ownership and business rules in services/application logic.
6. Use `ProblemDetails` / validation problem responses consistently.
7. Keep `/me` endpoints identity-derived; never accept `AlunoId` from the frontend for own-profile operations.
8. Use explicit mapping. Do not add AutoMapper.
9. Keep list payloads compact; load full profile data only in preview/detail endpoints.
10. Do not create endpoints that are not needed by approved screens.

Read `references/api-conventions.md` when implementing API behavior.

If the endpoint touches domain restrictions, also apply `talent-valley-domain-rules`.
If it touches authentication/authorization, also apply `talent-valley-auth-security`.
