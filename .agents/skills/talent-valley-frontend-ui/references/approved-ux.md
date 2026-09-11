# Approved UX

## Student

Login → `/meu-perfil`.

No student dashboard in MVP.

Single profile page with sections:
- header/photo/name/location;
- About;
- Contact;
- Formation and certifications;
- Experience;
- Competencies;
- Languages;
- Availability;
- Projects;
- CV.

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
