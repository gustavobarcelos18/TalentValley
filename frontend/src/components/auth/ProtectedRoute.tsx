"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CircularProgress, Stack } from "@mui/material";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { AuthCheckError } from "@/components/auth/AuthCheckError";
import { useAuth } from "@/hooks/useAuth";
import { TERMS_ACCEPTANCE_PATH } from "@/lib/paths";
import type { UserRole } from "@/types/auth";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  /** Only the terms acceptance screen sets this: everywhere else, pending terms redirect to it. */
  allowPendingTerms?: boolean;
}

export function ProtectedRoute({ children, allowedRoles, allowPendingTerms = false }: ProtectedRouteProps) {
  const { user, loading, error, refreshUser } = useAuth();
  const router = useRouter();
  const termsPending = Boolean(user?.termosPendentes) && !allowPendingTerms;

  useEffect(() => {
    if (loading) return;

    // An operational auth-check failure leaves the session state UNKNOWN, so
    // do not redirect to /login merely because of a temporary outage.
    if (!user && error) return;

    if (!user) {
      router.replace("/login");
    } else if (termsPending) {
      router.replace(TERMS_ACCEPTANCE_PATH);
    }
  }, [user, loading, error, termsPending, router]);

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

  // Never render the protected content while the terms are pending, not even for a moment before the redirect.
  if (!user || termsPending) {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <AccessDenied role={user.role} />;
  }

  return <>{children}</>;
}
