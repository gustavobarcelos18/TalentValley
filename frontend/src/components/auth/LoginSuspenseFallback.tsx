"use client";

import { Box, CircularProgress, Stack, Typography } from "@mui/material";

// Login-specific Suspense fallback: a quiet full-viewport surface matching the
// new login composition. The shared AuthSuspenseFallback keeps its default
// card layout for the other authentication screens.
export function LoginSuspenseFallback() {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        bgcolor: "background.default",
      }}
    >
      <Stack
        spacing={2}
        sx={{ alignItems: "center" }}
        role="status"
        aria-live="polite"
      >
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Carregando...
        </Typography>
      </Stack>
    </Box>
  );
}
