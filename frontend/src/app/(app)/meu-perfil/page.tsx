"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { StudentProfile } from "@/components/profile/StudentProfile";

export default function MeuPerfilPage() {
  return (
    <ProtectedRoute allowedRoles={["ALUNO"]}>
      <AppShell>
        <StudentProfile />
      </AppShell>
    </ProtectedRoute>
  );
}
