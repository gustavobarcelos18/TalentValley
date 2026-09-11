# API Conventions

Base prefix:

```text
/api
```

## HTTP semantics

- `200` query or response body
- `201` resource created
- `202` accepted where responses must avoid sensitive account disclosure
- `204` successful command without body
- `400` invalid input
- `401` unauthenticated
- `403` authenticated but unauthorized/inactive
- `404` unavailable resource or resource not owned by current user
- `409` business-rule conflict
- `413` upload too large
- `415` unsupported media
- `423` Identity lockout where used

## Pagination

Talent discovery/admin lists:
- 10 per page.

Audit:
- 20 per page.

Use a reusable response such as:

```csharp
public sealed record PaginatedResponse<T>(
    IReadOnlyCollection<T> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages);
```

## Error responses

Prefer ASP.NET Core `ProblemDetails`.
Include trace ID when available.

Do not reveal whether an email exists during login/forgot-password.

## Main route families

### Auth
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/activate-account`
- `GET /api/auth/csrf`

### Student self-service
- `/api/alunos/me`
- `/api/alunos/me/dados-basicos`
- `/api/alunos/me/sobre`
- `/api/alunos/me/contato`
- `/api/alunos/me/competencias`
- `/api/alunos/me/idiomas`
- `/api/alunos/me/disponibilidade`
- `/api/alunos/me/formacoes`
- `/api/alunos/me/experiencias`
- `/api/alunos/me/projetos`
- `/api/alunos/me/foto`
- `/api/alunos/me/curriculo`

### Recruiter discovery
- `GET /api/talentos`
- `GET /api/talentos/{slug}/preview`
- `GET /api/talentos/{slug}`
- protected CV/certificate endpoints
- favorite endpoints
- compare exactly two talents
- recruiter dashboard/favorites

### Admin
- dashboard
- student access creation/management
- recruiter access creation/management
- RPV validation
- audit

## Search execution

Keep filtering, ranking, ordering, `Skip`, and `Take` in the database query.
Do not materialize all students and filter in memory.
