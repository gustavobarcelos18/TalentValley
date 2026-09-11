# Database Rules

## Core domain entities

- `ApplicationUser : IdentityUser<Guid>`
- `Aluno`
- `Recrutador`
- `Competencia`
- `AlunoCompetencia`
- `Idioma`
- `AlunoIdioma`
- `Formacao`
- `Experiencia`
- `Projeto`
- `ProjetoCompetencia`
- `AlunoDisponibilidade`
- `AlunoModalidade`
- `Favorito`
- `Auditoria`

Identity internal tables remain managed by Identity.

## Key relationships

- `ApplicationUser` 1:1 `Aluno`
- `ApplicationUser` 1:1 `Recrutador`
- `Aluno` N:M `Competencia` through `AlunoCompetencia`
- `Aluno` N:M `Idioma` through `AlunoIdioma`
- `Aluno` 1:N `Formacao`
- `Aluno` 1:N `Experiencia`
- `Aluno` 1:N `Projeto`, business maximum 2
- `Projeto` N:M `Competencia` through `ProjetoCompetencia`
- `Recrutador` N:M `Aluno` through `Favorito`

## Important keys/constraints

- `Aluno.UserId` PK/FK
- `Recrutador.UserId` PK/FK
- `Aluno.Slug` unique
- `Competencia.NomeBusca` unique
- `Idioma.NomeBusca` unique
- composite PK `AlunoCompetencia(AlunoId, CompetenciaId)`
- composite PK `AlunoIdioma(AlunoId, IdiomaId)`
- composite PK `ProjetoCompetencia(ProjetoId, CompetenciaId)`
- composite PK `AlunoDisponibilidade(AlunoId, Tipo)`
- composite PK `AlunoModalidade(AlunoId, Modalidade)`
- composite PK `Favorito(RecrutadorId, AlunoId)`
- `Projeto.Ordem` must be 1 or 2
- unique `(AlunoId, Ordem)`
- one principal formation per student via filtered/partial unique index where `Principal = true`

## SQLite initialization

Apply:
- `PRAGMA journal_mode=WAL;`
- `PRAGMA foreign_keys=ON;`
- `PRAGMA synchronous=NORMAL;`

## Important indexes

Create/query indexes for:
- normalized user name
- `Aluno.Slug`
- `Aluno(Uf, Cidade)`
- `Aluno.AtualizadoEm`
- recruiter status
- competence lookup
- `AlunoCompetencia(CompetenciaId, AlunoId)`
- formation type/status/name/RPV validation
- project updated date / student
- `ProjetoCompetencia(CompetenciaId, ProjetoId)`
- availability and modality lookups
- audit created timestamp

Do not persist relevance/comparison/trajectory/dashboard data.
