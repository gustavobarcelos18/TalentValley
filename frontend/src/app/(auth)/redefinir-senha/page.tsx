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
import { resetPassword } from "@/lib/auth";
import { getAuthErrorMessage } from "@/lib/authErrors";
import { validatePassword } from "@/lib/validation";

const EYEBROW = "RECUPERAR ACESSO";

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<AuthSuspenseFallback />}>
      <RedefinirSenhaContent />
    </Suspense>
  );
}

function RedefinirSenhaContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [linkRejected, setLinkRejected] = useState(false);

  const novaSenhaInputRef = useRef<HTMLInputElement | null>(null);
  const confirmacaoInputRef = useRef<HTMLInputElement | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const [errorSequence, setErrorSequence] = useState(0);
  const lastErrorFocus = useRef<"novaSenha" | "confirmacao" | null>(null);

  const missingParams = !email || !token;

  // After a failed submit, move focus to the first invalid field or, for
  // submission errors, to the error summary. The sequence id re-runs the
  // effect even when the same error message is reported twice in a row.
  useEffect(() => {
    if (errorSequence === 0) return;
    if (lastErrorFocus.current === "novaSenha") {
      novaSenhaInputRef.current?.focus();
    } else if (lastErrorFocus.current === "confirmacao") {
      confirmacaoInputRef.current?.focus();
    } else {
      errorAlertRef.current?.focus();
    }
  }, [errorSequence]);

  function reportError(
    message: string,
    focus: "novaSenha" | "confirmacao" | null = null,
  ) {
    lastErrorFocus.current = focus;
    setError(message);
    setErrorSequence((n) => n + 1);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const senhaError = validatePassword(novaSenha);
    if (senhaError) {
      reportError(senhaError, "novaSenha");
      return;
    }

    if (novaSenha !== confirmacao) {
      reportError("As senhas não coincidem.", "confirmacao");
      return;
    }

    setLoading(true);

    try {
      await resetPassword({ email, token, novaSenha });
      setSuccess(true);
    } catch (err) {
      // The password already passed the client rules, so a 400 means the link
      // was rejected (expired, already used or tampered with).
      if (err instanceof ApiError && err.status === 400) {
        setLinkRejected(true);
      } else {
        reportError(
          getAuthErrorMessage(err, {
            fallback: "Não foi possível redefinir a senha. Tente novamente.",
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
            ? "Este link de redefinição está incompleto. Solicite um novo."
            : "Este link de redefinição é inválido, expirou ou já foi usado. Solicite um novo."
        }
        actionHref="/esqueci-senha"
        actionLabel="Solicitar novo link"
        footer={<AuthFooterLink href="/login">Voltar ao login</AuthFooterLink>}
      />
    );
  }

  if (success) {
    return (
      <AuthResultPage
        eyebrow={EYEBROW}
        title="Senha redefinida"
        severity="success"
        message="Sua senha foi redefinida com sucesso."
        actionHref="/login"
        actionLabel="Ir para o login"
      />
    );
  }

  return (
    <AuthFormPage
      eyebrow={EYEBROW}
      title="Redefinir senha"
      subtitle="Digite sua nova senha"
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
        id="novaSenha"
        name="novaSenha"
        label="Nova senha"
        autoComplete="new-password"
        value={novaSenha}
        onChange={(e) => setNovaSenha(e.target.value)}
        inputRef={novaSenhaInputRef}
        disabled={loading}
        showRules
      />

      <PasswordField
        id="confirmacao"
        name="confirmacao"
        label="Confirmação da nova senha"
        autoComplete="new-password"
        value={confirmacao}
        onChange={(e) => setConfirmacao(e.target.value)}
        inputRef={confirmacaoInputRef}
        disabled={loading}
      />

      <Button type="submit" variant="contained" size="large" fullWidth disabled={loading}>
        {loading ? "Redefinindo..." : "Redefinir senha"}
      </Button>
    </AuthFormPage>
  );
}
