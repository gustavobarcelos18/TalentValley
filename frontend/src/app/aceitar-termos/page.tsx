"use client";

import { AcceptTermsScreen } from "@/components/account/AcceptTermsScreen";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

// Outside the (app) group on purpose: no menu to blocked pages. The admin never has pending terms.
export default function AcceptTermsPage() {
  return (
    <ProtectedRoute allowedRoles={["ALUNO", "RECRUTADOR"]} allowPendingTerms>
      <AcceptTermsScreen />
    </ProtectedRoute>
  );
}
