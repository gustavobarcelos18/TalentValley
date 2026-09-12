"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

interface GuestOnlyProps {
  children: ReactNode;
}

export function GuestOnly({ children }: GuestOnlyProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (user) {
      const destination = getRoleDestination(user.role);
      router.replace(destination);
    }
  }, [user, loading, router]);

  if (loading || user) {
    return null;
  }

  return <>{children}</>;
}

function getRoleDestination(role: string): string {
  switch (role) {
    case "ALUNO":
      return "/meu-perfil";
    case "RECRUTADOR":
      return "/recrutador";
    case "ADMIN":
      return "/admin";
    default:
      return "/login";
  }
}
