"use client";

import { ExclusaoSection } from "@/components/profile/ExclusaoSection";
import { useAuth } from "@/hooks/useAuth";
import { deleteOwnRecruiterAccount } from "@/lib/recruiter";

const RECRUITER_WARNING =
  "Esta ação é irreversível. Sua conta, seus favoritos e seus dados de acesso serão permanentemente deletados.";

// Recruiter-only self-deletion. The backend enforces the role; this only hides the
// section from students and admins on the shared password page.
export function RecruiterAccountDeletion() {
  const { user } = useAuth();
  if (user?.role !== "RECRUTADOR") return null;
  return <ExclusaoSection deleteAccount={deleteOwnRecruiterAccount} warning={RECRUITER_WARNING} />;
}
