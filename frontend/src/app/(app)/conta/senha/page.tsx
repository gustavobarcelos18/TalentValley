"use client";

import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { RecruiterAccountDeletion } from "@/components/account/RecruiterAccountDeletion";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";

export default function ChangePasswordPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <div className="flex flex-1 items-start justify-center px-5 py-12 sm:items-center">
          <div className="flex w-full max-w-[440px] flex-col gap-6">
            <ChangePasswordForm />
            <RecruiterAccountDeletion />
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
