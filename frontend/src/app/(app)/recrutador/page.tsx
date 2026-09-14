"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import { RecruiterDashboardView } from "@/components/recruiter/RecruiterDashboardView";

export default function RecrutadorPage() {
  return (
    <ProtectedRoute allowedRoles={["RECRUTADOR"]}>
      <AppShell><RecruiterDashboardView /></AppShell>
    </ProtectedRoute>
  );
}
