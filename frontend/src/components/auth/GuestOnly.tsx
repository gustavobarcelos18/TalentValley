"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircularProgress, Stack, Typography } from "@mui/material";
import { useAuth } from "@/hooks/useAuth";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

interface GuestOnlyProps {
  children: ReactNode;
}

export function GuestOnly({ children }: GuestOnlyProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (user) {
      const destination = getRoleDestination(user.role);
      router.replace(destination);
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <AuthPageShell>
        <LoadingStatus message="Verificando acesso..." />
      </AuthPageShell>
    );
  }

  if (user) {
    return (
      <AuthPageShell>
        <LoadingStatus message="Redirecionando..." />
      </AuthPageShell>
    );
  }

  return <>{children}</>;
}

function LoadingStatus({ message }: { message: string }) {
  return (
    <Stack
      spacing={2}
      sx={{ alignItems: "center", justifyContent: "center" }}
      role="status"
      aria-live="polite"
    >
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Stack>
  );
}

function getRoleDestination(role: string): string {
  switch (role) {
    case "ALUNO":
      return "/meu-perfil";
    case "RECRUTADOR":
      return "/recrutador";
    case "ADMIN":
      return "/admin";
    default:
      return "/login";
  }
}
