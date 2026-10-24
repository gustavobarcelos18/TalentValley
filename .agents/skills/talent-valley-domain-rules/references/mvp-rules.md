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

Recruiter:
- may delete own account (LGPD) after confirming the current password; only while `ATIVO`;
- deletion removes account, profile, favorites and registration requests with the same email.

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
- may delete a recruiter only after blocking it (active recruiter returns 409);
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

## What the student is looking for ("O que eu busco")

Replaces the old "Disponibilidade e modalidade" section. Saved as one form by `PUT /api/alunos/me/disponibilidade` (full replacement).

- Search status: `BUSCANDO_ATIVAMENTE`, `ABERTO_A_PROPOSTAS`, `NAO_BUSCANDO`. Empty means "not informed" (existing students).
- A student who is not looking (`NAO_BUSCANDO`) still appears in recruiter search, with a visible warning.
- The status counts as outdated when it was not confirmed for more than 30 days. It stays visible with a warning. The backend computes `statusDesatualizado`. The only reminder is an in-app notice (no email, no scheduled job).
- The status is reconfirmed only by saving the form or by `POST /api/alunos/me/busca/confirmar` (409 when no status is set). Editing other parts of the profile never reconfirms.
- Professional objective: up to 280 characters, no emoji, no line breaks.
- Areas of interest: own list (`AreaInteresse`, stored as text, so adding values needs no migration), at most 5, no repeats.
- Available from: either "immediately" or a date, never both. A past date is shown as "Imediato".
- Weekly workload (optional): `ATE_20H`, `ATE_30H`, `ATE_40H`.
- Mobility: two yes/no answers, `AceitaViajar` (for work) and `AceitaMudarDeCidade`.
- Driver's license: categories `A`, `B`, `C`, `D`, `E` (none means no license) plus `PossuiVeiculoProprio`. Declared by the student. Never store the license number, a photo or a document.
- PCD (sensitive data, LGPD art. 11, always optional): `SouPcd`, `InteresseVagaPcd` and disability types (`FISICA`, `VISUAL`, `AUDITIVA`, `INTELECTUAL`, `MULTIPLA`, `TEA`, `OUTRA`). Disability types are only kept while `SouPcd` is on.
- PCD consent: saving `SouPcd` or `InteresseVagaPcd` requires the consent box ("Autorizo compartilhar esta informação com recrutadores cadastrados"); the backend refuses to save otherwise. `ConsentimentoPcdEm` is the date of the latest save with the box marked, and it is cleared, together with the disability types, when the student turns the PCD fields off.
- Saving the same answers again does not change `AtualizadoEm`; it still reconfirms the status.
- Recruiters and admins see the three PCD fields, but PCD data is only exposed when `ConsentimentoPcdEm` exists. Only `InteresseVagaPcd` is a search filter. The recruiter screen shows a fixed notice: PCD information may only be used to find and contact students.
- The license is shown as "informado pelo aluno".
- Recruiter search gets these new filters: search status, area of interest, mobility (travel / move city), license category and interest in PCD jobs. Start date, workload, own vehicle and disability type are shown but never filter.
- Comparison: the "in common" block also lists the areas of interest and license categories both students share. Search status, mobility, workload and PCD are never crossed.
- The landing page texts that mention "disponibilidade" are not changed.
- The LGPD export includes all of this, and account deletion removes all of it.

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
- work modality;
- search status, area of interest, mobility, driver's license category and interest in PCD jobs (see "What the student is looking for").

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
- recruiter deleted (by admin, or by the recruiter as a self-service entry);
- RPV approved;
- RPV rejected;
- RPV verification removed.

Audit is chronological/read-only in MVP.
No audit filters required.

Audit survives deletion of the target entity.

## Demonstration mode

Fictitious accounts (`EhDemo`) exist only for presentations and are isolated from real data:
- the admin can view the app as one fictitious student or recruiter (off by default, `Demo:Enabled`);
- a real recruiter never sees, favorites, compares or downloads a demo student; the demo recruiter sees only demo students (the check lives in `TalentVisibility`);
- admin lists, dashboard numbers and RPV validations do not include demo accounts;
- demo accounts are created without files and without a password (an upload made while the admin acts as a demo student is removed by "Restaurar demonstração");
- the admin may act normally while viewing as a demo account; "Restaurar demonstração" undoes it and never touches real accounts.

## Data retention

Rejected registration requests are deleted after 30 days, on the next admin list view.
