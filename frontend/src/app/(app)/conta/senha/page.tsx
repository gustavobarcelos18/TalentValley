"use client";

import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";

export default function ChangePasswordPage() {
  return (
    <ProtectedRoute>
      <AppShell>
        <div className="flex flex-1 items-start justify-center px-5 py-12 sm:items-center">
          <div className="w-full max-w-[440px]">
            <ChangePasswordForm />
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
