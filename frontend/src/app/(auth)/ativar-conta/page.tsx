"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Button } from "@mui/material";
import { AuthFooterLink } from "@/components/auth/AuthFooterLink";
import { AuthFormPage } from "@/components/auth/AuthFormPage";
import { AuthResultPage } from "@/components/auth/AuthResultPage";
import { AuthSuspenseFallback } from "@/components/auth/AuthSuspenseFallback";
import { PasswordField } from "@/components/auth/PasswordField";
import { ApiError } from "@/lib/api";
import { activateAccount } from "@/lib/auth";
import { getAuthErrorMessage } from "@/lib/authErrors";
import { validatePassword } from "@/lib/validation";

const EYEBROW = "ATIVAÇÃO DE CONTA";

export default function AtivarContaPage() {
  return (
    <Suspense fallback={<AuthSuspenseFallback />}>
      <AtivarContaContent />
    </Suspense>
  );
}

function AtivarContaContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [linkRejected, setLinkRejected] = useState(false);

  const senhaInputRef = useRef<HTMLInputElement | null>(null);
  const confirmacaoInputRef = useRef<HTMLInputElement | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const [errorSequence, setErrorSequence] = useState(0);
  const lastErrorFocus = useRef<"senha" | "confirmacao" | null>(null);

  const missingParams = !email || !token;

  // After a failed submit, move focus to the first invalid field or, for
  // submission errors, to the error summary. The sequence id re-runs the
  // effect even when the same error message is reported twice in a row.
  useEffect(() => {
    if (errorSequence === 0) return;
    if (lastErrorFocus.current === "senha") {
      senhaInputRef.current?.focus();
    } else if (lastErrorFocus.current === "confirmacao") {
      confirmacaoInputRef.current?.focus();
    } else {
      errorAlertRef.current?.focus();
    }
  }, [errorSequence]);

  function reportError(
    message: string,
    focus: "senha" | "confirmacao" | null = null,
  ) {
    lastErrorFocus.current = focus;
    setError(message);
    setErrorSequence((n) => n + 1);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const senhaError = validatePassword(senha);
    if (senhaError) {
      reportError(senhaError, "senha");
      return;
    }

    if (senha !== confirmacao) {
      reportError("As senhas não coincidem.", "confirmacao");
      return;
    }

    setLoading(true);

    try {
      await activateAccount({ email, token, senha });
      setSuccess(true);
    } catch (err) {
      // The password already passed the client rules, so a 400 means the link
      // was rejected (expired, already used or tampered with).
      if (err instanceof ApiError && err.status === 400) {
        setLinkRejected(true);
      } else {
        reportError(
          getAuthErrorMessage(err, {
            fallback: "Não foi possível ativar a conta. Tente novamente.",
          }),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (missingParams || linkRejected) {
    return (
      <AuthResultPage
        eyebrow={EYEBROW}
        title="Link inválido ou expirado"
        severity="error"
        message={
          missingParams
            ? "Este link de ativação está incompleto. Solicite um novo."
            : "Este link de ativação é inválido, expirou ou já foi usado. Solicite um novo."
        }
        actionHref="/reenviar-ativacao"
        actionLabel="Solicitar novo link"
        footer={<AuthFooterLink href="/login">Voltar ao login</AuthFooterLink>}
      />
    );
  }

  if (success) {
    return (
      <AuthResultPage
        eyebrow={EYEBROW}
        title="Conta ativada"
        severity="success"
        message="Conta ativada com sucesso! Você já pode fazer login."
        actionHref="/login"
        actionLabel="Ir para o login"
      />
    );
  }

  return (
    <AuthFormPage
      eyebrow={EYEBROW}
      title="Ativar conta"
      subtitle="Defina sua senha para ativar seu acesso"
      onSubmit={handleSubmit}
      ariaBusy={loading}
      footer={<AuthFooterLink href="/login">Voltar ao login</AuthFooterLink>}
    >
      {error && (
        <Alert
          ref={errorAlertRef}
          tabIndex={-1}
          severity="error"
          variant="filled"
          sx={{ fontSize: "0.875rem" }}
        >
          {error}
        </Alert>
      )}

      <PasswordField
        id="senha"
        name="senha"
        label="Senha"
        autoComplete="new-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        inputRef={senhaInputRef}
        disabled={loading}
        showRules
      />

      <PasswordField
        id="confirmacao"
        name="confirmacao"
        label="Confirmação da senha"
        autoComplete="new-password"
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        inputRef={confirmacaoInputRef}
        disabled={loading}
      />

      <Button type="submit" variant="contained" size="large" fullWidth disabled={loading}>
        {loading ? "Ativando..." : "Ativar minha conta"}
      </Button>
    </AuthFormPage>
  );
}
