# Approved UX

## Student

Login → `/meu-perfil`.

No student dashboard in MVP.

Single profile page: a header, then the sections in three titled blocks, with an index to jump between them.

Header: photo, name, city/UF, last update, and one "Editar" button for name and location (the only place where they are edited).

Blocks and sections, in this order:
- Presentation: About; Contact;
- Formation and experience: Trajectory (formation, certificates and experience); Competencies; Languages;
- For recruiters: What I am looking for; Projects; CV.

Index: a sticky side list on very wide screens (from `xl`), sticky chips under the top bar on smaller ones. Plain links to the section anchors (`secao-<id>`, see `profileSections.ts`), the visible section marked with `aria-current`.

Edit each section using focused MUI dialogs/modals.

Do not add:
- profile completion percentage;
- "view as recruiter";
- generated CV;
- extra dashboard.

## Recruiter dashboard

Prominent search.

Exactly three main indicators:
- profiles updated since last access;
- new students;
- favorites count.

CTA:
- Explore talents.

Show recent favorites.

## Discover talents

- desktop filters in drawer;
- mobile filters in large/full-ish modal;
- compact result list;
- 10 results per page;
- sort relevance/recent/name;
- checkboxes to select exactly 2 for comparison;
- do not allow a third comparison selection;
- clicking a result opens a large MUI preview dialog first;
- preview includes favorite action and "View full profile";
- full page at `/recrutador/talentos/[slug]`.

## Full talent profile

Order:
1. Header
2. About
3. Competencies
4. Trajectory
5. Projects
6. Languages
7. Contact
8. Availability and work modes
9. Résumé

Availability and résumé were added after the original seven (decided 2026-10-18) and stay last.

Trajectory visually combines formation + experience, newest first.
Projects remain a separate section.

Certificates appear inside their formation item.

## Compare

Exactly two students.

Layout concept:
`Student A | IN COMMON | Student B`

Shared competencies centered.
Exclusive competencies on each side.
No scoring/winner highlighting.

## Admin

Routes:
- `/admin`
- `/admin/alunos`
- `/admin/recrutadores`
- `/admin/validacoes-rpv`
- `/admin/auditoria`

Admin dashboard is operational, not BI-heavy.

Student management:
- modern list, not traditional data table;
- search;
- read-only profile view;
- block/reactivate/delete;
- create student access.

Recruiter management:
- modern list;
- active/blocked only;
- create recruiter access;
- details;
- block/reactivate.

RPV validation:
- list → detail → certificate → approve/reject;
- verified item can have verification removed.

Audit:
- chronological read-only list;
- no advanced filters in MVP.

Demonstration mode:
- card "Demonstração" in `/admin` with a "Preparada"/"Não preparada" chip; when not prepared it shows only "Preparar demonstração"; when prepared it shows "Ver como Aluno", "Ver como Recrutador" and "Restaurar demonstração" (with confirmation); the card does not appear when `Demo:Enabled` is off;
- sticky banner on every screen of a demo session ("Modo demonstração: você está vendo como {Aluno|Recrutador}. Dados fictícios.") with "Voltar ao Admin"; it shares one sticky container with the app bar, and `--demo-banner-height` moves the comparison bar down;
- "Alterar senha" and "Excluir conta" are hidden in a demo session;
- a demo session that ends (401) goes to `/login?sessao=demo`;
- switching in or out reloads the whole page (`window.location.assign`).
