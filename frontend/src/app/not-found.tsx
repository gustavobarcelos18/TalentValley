import { AuthShell } from "@/components/auth/AuthLayout";
import { SystemStatePage } from "@/components/auth/SystemStatePage";

export default function NotFound() {
  return (
    <AuthShell>
      <SystemStatePage
        scene="lost"
        eyebrow="ERRO 404"
        title="Página não encontrada"
        message="O endereço que você tentou abrir não existe ou foi movido."
        severity="info"
        action={{ label: "Ir para o início", href: "/" }}
      />
    </AuthShell>
  );
}
