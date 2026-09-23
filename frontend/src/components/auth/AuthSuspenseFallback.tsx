"use client";

import { CircularProgress, Stack, Typography } from "@mui/material";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

// Compact, accessible loading state used as the Suspense fallback for the
// authentication pages that read URL params through useSearchParams.
export function AuthSuspenseFallback() {
  return (
    <AuthPageShell>
      <Stack
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "center" }}
        role="status"
        aria-live="polite"
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Carregando...
        </Typography>
      </Stack>
    </AuthPageShell>
  );
}
