import type { ReactNode } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GuestOnly } from "@/components/auth/GuestOnly";

export default function AuthRouteLayout({ children }: { children: ReactNode }) {
  return (
    <GuestOnly>
      <AuthLayout>{children}</AuthLayout>
    </GuestOnly>
  );
}
