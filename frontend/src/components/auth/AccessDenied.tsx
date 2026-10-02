"use client";

import { getRoleDestination } from "@/lib/paths";
import type { UserRole } from "@/types/auth";
import { AuthShell } from "./AuthLayout";
import { SystemStatePage } from "./SystemStatePage";

// Shown by ProtectedRoute when the signed-in role may not open the page. The
// action takes the user to the home of their own role.
export function AccessDenied({ role }: { role: UserRole }) {
  return (
    <AuthShell variant="system">
      <SystemStatePage
        eyebrow="ERRO 403"
        title="Acesso negado"
        message="Seu perfil não tem permissão para acessar esta página."
        severity="warning"
        action={{ label: "Ir para minha área", href: getRoleDestination(role) }}
      />
    </AuthShell>
  );
}
