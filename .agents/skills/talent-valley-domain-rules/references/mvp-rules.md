# Approved MVP Business Rules

## Roles and access

Exactly:
- `ALUNO`
- `RECRUTADOR`
- `ADMIN`

Student profiles are private. They are never public internet pages.

Prospective students and recruiters submit a public registration request. An ADMIN reviews it; only approval creates the Identity account and corresponding profile, then the existing activation flow lets the person define a password and log in.

Canonical access flow: `PUBLIC REQUEST → ADMIN APPROVAL → ACCOUNT CREATION → ACTIVATION → LOGIN`.

Recruiter states:
- `ATIVO`
- `BLOQUEADO`

Student:
- owns and edits only own profile;
- cannot make profile private;
- cannot edit another student.

Admin:
- may create access;
- may view student profile read-only;
- may block/reactivate/delete student;
- must not edit student professional profile;
- may create/block/reactivate recruiter;
- validates RPV education.

## Student profile

Contains:
- photo;
- full name;
- city;
- UF;
- phone;
- professional email;
- optional LinkedIn/GitHub/portfolio;
- bio max 1500 chars;
- competencies;
- languages;
- availability;
- work modalities;
- education/certifications;
- experience;
- max 2 highlighted projects;
- uploaded CV PDF.

No generated CV PDF in MVP.
No student dashboard in MVP; login goes directly to `/meu-perfil`.

## Competencies

No self-assessed skill level.

Project technologies use the same `Competencia` catalog.

A project competence does not automatically become a general student competence.

## Languages

Levels:
- `BASICO`
- `INTERMEDIARIO`
- `AVANCADO`
- `FLUENTE`
- `NATIVO`

Languages are not recruiter search filters in MVP.

## Availability

Types:
- `ESTAGIO`
- `CLT`
- `PJ`
- `FREELANCER`
- `TRAINEE`

Modalities:
- `PRESENCIAL`
- `HIBRIDO`
- `REMOTO`

Multiple values are allowed.

## Formation

Types:
- `CURSO_LIVRE`
- `TECNICO`
- `TECNOLOGO`
- `GRADUACAO`
- `POS_GRADUACAO`

Statuses:
- `EM_ANDAMENTO`
- `CONCLUIDO`
- `TRANCADO`

At most one principal formation.

If a new formation becomes principal, unset the previous principal automatically.

RPV:
- student marks `EhRioPombaValley`;
- initial validation state becomes `PENDENTE`;
- only admin may set verified/rejected;
- verification requires a certificate;
- validation states: `PENDENTE`, `VERIFICADO`, `REJEITADO`;
- changing relevant data or certificate on a verified/rejected RPV formation resets it to `PENDENTE`;
- removing certificate from RPV formation must not leave it verified;
- admin may remove a verification, returning it to `PENDENTE`.

Completed formation requires an end date.
End date must not precede start date.

## Experience

Types:
- `PROFISSIONAL`
- `ESTAGIO`

Current experience has no end date.
No volunteer category in MVP.

Experience is shown on profiles but is not a recruiter search filter.

## Projects

Maximum 2 per student.

Order values:
- 1
- 2

If moving project 1 to 2 when 2 exists, swap positions.
If one of two projects is deleted, the remaining project becomes order 1.

Description max 1000 chars.

Optional independent links:
- demo/application URL;
- repository URL.

No project image/gallery/team flag/RPV flag/internal project page.

## Recruiter discovery

Filters:
- student name;
- city;
- UF;
- competencies;
- formation type;
- formation/course name;
- formation status;
- verified RPV formation;
- availability;
- work modality.

No filters for:
- institution;
- language;
- professional experience.

Different filter groups combine with AND.
Multiple values inside the same normal group combine with OR.

Results:
- 10 per page.
- only active students.

Sort:
- relevance;
- recently updated;
- name.

If there are filters, default relevance.
Without filters, default recent.

Relevance is deterministic, never AI and never shown as a percentage.

Suggested internal weighting:
- requested competence in `AlunoCompetencia`: 2;
- requested competence only in `ProjetoCompetencia`: 1;
- other satisfied filter group: 1.

Tie-break:
1. `AtualizadoEm DESC`
2. normalized name ASC

## Favorites

Favorite relation belongs to the current recruiter.
Add/remove operations should be idempotent.

## Comparison

Exactly 2 students.

No score, percentage, winner, better/worse badge, or ranking.

Shared competencies appear separately/in the center.
Exclusive competencies remain on each student's side.

## Recruiter dashboard

Only:
- profiles updated since last access;
- new students since last access;
- favorites count;
- recent favorites.

Use login timestamps; do not create a special updates table.

## Admin dashboard

Primary metrics:
- active students;
- active recruiters;
- pending RPV validations;
- profiles updated in last 7 days.

May also show verified RPV formations and most registered competencies.

No recruiter-pending metric.

## Audit

Audit important admin actions:
- student created;
- student blocked;
- student reactivated;
- student deleted;
- recruiter created;
- recruiter blocked;
- recruiter reactivated;
- RPV approved;
- RPV rejected;
- RPV verification removed.

Audit is chronological/read-only in MVP.
No audit filters required.

Audit survives deletion of the target entity.
