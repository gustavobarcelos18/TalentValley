"use client";

import type { FormEvent, ReactNode } from "react";
import { Box, Container, Paper, Stack, Typography } from "@mui/material";

interface AuthPageShellProps {
  /** Card heading; omitted only in bare mode. */
  title?: string;
  subtitle?: string;
  /** Supplying a handler turns the card surface into a form. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  /** Marks the form as busy while a submission is in progress. */
  ariaBusy?: boolean;
  /** Renders only the page background, without the card. */
  bare?: boolean;
  children?: ReactNode;
}

// Shared frame for the authentication screens: full-height page background,
// centered narrow container and the bordered card surface with the heading
// block. Forms and non-form surfaces (success/invalid-link states) use the
// same frame.
export function AuthPageShell({
  title,
  subtitle,
  onSubmit,
  ariaBusy,
  bare = false,
  children,
}: AuthPageShellProps) {
  return (
    <Box
      component="main"
      className="flex min-h-screen items-center px-4 py-12"
      sx={{ bgcolor: "background.default" }}
    >
      {bare ? null : (
        <Container maxWidth="xs">
          <Paper
            component={onSubmit ? "form" : "div"}
            onSubmit={onSubmit}
            aria-busy={ariaBusy || undefined}
            elevation={0}
            noValidate={onSubmit !== undefined}
            sx={{
              border: 1,
              borderColor: "divider",
              p: 4,
              bgcolor: "background.paper",
            }}
          >
            <Stack spacing={3}>
              {title && (
                <Stack spacing={1} sx={{ textAlign: "center" }}>
                  <Typography component="h1" variant="h5">
                    {title}
                  </Typography>
                  {subtitle && (
                    <Typography variant="body2" color="text.secondary">
                      {subtitle}
                    </Typography>
                  )}
                </Stack>
              )}
              {children}
            </Stack>
          </Paper>
        </Container>
      )}
    </Box>
  );
}
