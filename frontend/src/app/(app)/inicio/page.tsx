"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { StudentHome } from "@/components/student/StudentHome";

export default function InicioPage() {
  return (
    <ProtectedRoute allowedRoles={["ALUNO"]}>
      <StudentHome />
    </ProtectedRoute>
  );
}
