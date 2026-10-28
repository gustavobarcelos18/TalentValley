"use client";

import { StudentAccountView } from "@/components/account/StudentAccountView";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Students only: recruiters reach their privacy section at /conta/privacidade and admins have no such page.
export default function AccountPage() {
  return (
    <ProtectedRoute allowedRoles={["ALUNO"]}>
      <StudentAccountView />
    </ProtectedRoute>
  );
}
