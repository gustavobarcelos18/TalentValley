---
name: talent-valley-frontend-ui
description: Use when implementing or modifying Talent Valley Next.js pages, React components, MUI theme/components, Tailwind layout, responsive behavior, animations, dialogs, recruiter UX, student profile UX, or admin UX.
---

# Talent Valley Frontend UI

Read `references/approved-ux.md` when building a screen or interaction.

## Stack rules

- Next.js
- React
- TypeScript
- MUI / Material Design
- custom Talent Valley/RPV MUI theme
- Tailwind primarily for layout/composition/responsiveness
- Framer Motion for normal animation
- GSAP only for advanced landing-page scroll/parallax
- Material Design icon ecosystem; do not add Lucide

## Styling discipline

Avoid mixing `sx`, Tailwind classes, inline styles, and styled components randomly.

Prefer:
- MUI theme + reusable MUI-based app components for functional UI;
- Tailwind for grid/flex/spacing/responsive composition;
- dedicated wrappers where recurring patterns justify them.

Internal screens should be clean and task-focused.
The public landing page may be cinematic and visually rich.

Do not add features that are not represented in approved UX.
