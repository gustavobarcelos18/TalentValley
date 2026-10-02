"use client";

import { Children, type FormEvent, type ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { keyframes } from "@mui/material/styles";
import { useShake } from "./motion/useShake";

interface AuthFormPageProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  /** Omit for result screens (success, invalid link) that have no form to submit. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  ariaBusy?: boolean;
  /** Changes to a new non-zero value on every submit error; each change shakes the content. */
  shakeKey?: number;
  /** Links under the form (alternative actions, back to start). */
  footer?: ReactNode;
  children?: ReactNode;
}

const rise = keyframes`
  from { opacity: 0; transform: translateY(16px); }
`;
const maskUp = keyframes`
  from { transform: translateY(105%); }
`;
const fade = keyframes`
  from { opacity: 0; }
`;

const STEP_MS = 60;
const MAX_CHILD_STEPS = 8;
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

// Reading order: eyebrow, title, subtitle, each form child, footer. Only `from` is declared and the
// fill mode is `backwards`, so once an element has entered, its own transforms are untouched.
const enter = (step: number, name: typeof rise | typeof maskUp = rise) => ({
  animation: `${name} 600ms ${EASE} ${step * STEP_MS}ms backwards`,
  "@media (prefers-reduced-motion: reduce)": { animation: `${fade} 200ms linear backwards` },
});

// Children of the form enter one after another (the same rule applies to any that mount later,
// such as an error alert).
const formChildrenSx: Record<string, object> = { "& > *": enter(3) };
for (let i = 0; i < MAX_CHILD_STEPS; i++) {
  formChildrenSx[`& > *:nth-child(${i + 1})`] = { animationDelay: `${(3 + i) * STEP_MS}ms` };
}
formChildrenSx["@media (prefers-reduced-motion: reduce)"] = { "& > *:nth-child(n)": { animationDelay: "0ms" } };

// Content of the form area of an entry screen: heading, form and footer links.
// Each part is its own wrapper so the sections can be targeted individually.
export function AuthFormPage({
  title,
  subtitle,
  eyebrow = "ACESSO À PLATAFORMA",
  onSubmit,
  ariaBusy,
  shakeKey = 0,
  footer,
  children,
}: AuthFormPageProps) {
  const shakeRef = useShake<HTMLDivElement>(shakeKey);
  const footerStep = 4 + Math.min(Children.toArray(children).length, MAX_CHILD_STEPS);

  return (
    <div ref={shakeRef}>
      <Box component="header">
        <Typography
          component="p"
          sx={{
            mb: 1.5,
            color: "primary.main",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.2em",
            lineHeight: 1.7,
            ...enter(0),
          }}
        >
          {eyebrow}
        </Typography>

        {/* The padding keeps descenders inside the clip; the negative margin cancels its height. */}
        <Box sx={{ overflow: "hidden", pb: "0.12em", mb: "-0.12em" }}>
          <Typography component="h1" variant="h4" sx={enter(1, maskUp)}>
            {title}
          </Typography>
        </Box>

        {subtitle && (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75, ...enter(2) }}>
            {subtitle}
          </Typography>
        )}
      </Box>

      <Stack
        component={onSubmit ? "form" : "div"}
        spacing={2.5}
        onSubmit={onSubmit}
        aria-busy={ariaBusy || undefined}
        noValidate={onSubmit ? true : undefined}
        sx={{ mt: 3, ...formChildrenSx }}
      >
        {children}
      </Stack>

      {footer && (
        <Box component="footer" sx={enter(footerStep)}>
          {footer}
        </Box>
      )}
    </div>
  );
}
