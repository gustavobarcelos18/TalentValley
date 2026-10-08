"use client";

import { AuthResultPage } from "@/components/auth/AuthResultPage";

// Confirmation shown in place of a registration wizard after the request is
// accepted. The message is neutral: the backend never reveals whether the
// e-mail was already registered.
export function RegistrationSuccess() {
  return (
    <AuthResultPage
      eyebrow="FAÇA PARTE DO TALENT VALLEY"
      title="Solicitação recebida"
      severity="success"
      message="Sua solicitação foi enviada e será analisada pela equipe do Talent Valley. Se aprovada, você receberá as instruções para ativar sua conta."
      actionHref="/"
      actionLabel="Voltar à página inicial"
    />
  );
}
