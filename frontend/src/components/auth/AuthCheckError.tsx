"use client";

import { Alert, Button, Stack } from "@mui/material";

interface AuthCheckErrorProps {
  message: string;
  onRetry: () => void;
}

// Recoverable auth-check error shared by ProtectedRoute and GuestOnly. Shown
// only when the session state is UNKNOWN (operational /api/auth/me failure),
// never when the session was actually determined to be unauthenticated.
export function AuthCheckError({ message, onRetry }: AuthCheckErrorProps) {
  return (
    <Stack spacing={2} sx={{ alignItems: "center", width: "100%" }}>
      <Alert severity="warning" sx={{ width: "100%" }}>
        {message}
      </Alert>
      <Button variant="contained" onClick={onRetry}>
        Tentar novamente
      </Button>
    </Stack>
  );
}
