"use client";

import type { FormEvent, ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

interface AuthFormPageProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  /** Omit for result screens (success, invalid link) that have no form to submit. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  ariaBusy?: boolean;
  /** Links under the form (alternative actions, back to start). */
  footer?: ReactNode;
  children?: ReactNode;
}

// Content of the form area of an entry screen: heading, form and footer links.
// Each part is its own wrapper so the sections can be targeted individually.
export function AuthFormPage({
  title,
  subtitle,
  eyebrow = "ACESSO À PLATAFORMA",
  onSubmit,
  ariaBusy,
  footer,
  children,
}: AuthFormPageProps) {
  return (
    <>
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
          }}
        >
          {eyebrow}
        </Typography>

        <Typography component="h1" variant="h4">
          {title}
        </Typography>

        {subtitle && (
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
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
        sx={{ mt: 3 }}
      >
        {children}
      </Stack>

      {footer && <Box component="footer">{footer}</Box>}
    </>
  );
}
