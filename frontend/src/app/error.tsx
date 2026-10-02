"use client";

import { AuthShell } from "@/components/auth/AuthLayout";
import { SystemStatePage } from "@/components/auth/SystemStatePage";

// The error message is never shown: on the server it is already generic, and
// a client error could carry internal details.
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <AuthShell>
      <SystemStatePage
        scene="failed"
        eyebrow="ERRO INESPERADO"
        title="Algo deu errado"
        message="Não foi possível carregar esta página. Tente novamente em instantes."
        severity="error"
        action={{ label: "Tentar novamente", onClick: retry }}
      />
    </AuthShell>
  );
}
