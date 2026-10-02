"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircularProgress, Stack } from "@mui/material";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { AuthCheckError } from "@/components/auth/AuthCheckError";
import { useAuth } from "@/hooks/useAuth";
import type { UserRole } from "@/types/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading, error, refreshUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // An operational auth-check failure leaves the session state UNKNOWN, so
    // do not redirect to /login merely because of a temporary outage.
    if (!user && error) return;

    if (!user) {
      router.replace("/login");
    }
  }, [user, loading, error, router]);

  if (loading) {
    return (
      <Stack
        sx={{ alignItems: "center", justifyContent: "center" }}
        className="min-h-screen"
        role="status"
        aria-label="Carregando"
      >
        <CircularProgress aria-label="Carregando" />
      </Stack>
    );
  }

  if (!user && error) {
    return (
      <Stack
        sx={{ alignItems: "center", justifyContent: "center", px: 2, gap: 2 }}
        className="min-h-screen"
      >
        <AuthCheckError message={error} onRetry={refreshUser} />
      </Stack>
    );
  }

  if (!user) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessDenied role={user.role} />;
  }

  return <>{children}</>;
}
