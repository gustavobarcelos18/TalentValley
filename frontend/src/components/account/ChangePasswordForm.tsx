"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@mui/material";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { useRetryCountdown } from "@/components/auth/motion/useRetryCountdown";
import { AuthFooterLink } from "@/components/auth/AuthFooterLink";
import { AuthFormPage } from "@/components/auth/AuthFormPage";
import { AuthResultPage } from "@/components/auth/AuthResultPage";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import { changePassword } from "@/lib/auth";
import { getAuthErrorMessage } from "@/lib/authErrors";
import { getRoleDestination } from "@/lib/paths";
import { validatePassword } from "@/lib/validation";

type FocusTarget = "senhaAtual" | "novaSenha" | "confirmacao";

const EYEBROW = "MINHA CONTA";

// Change-password screen of the signed-in area. The backend validates the
// current password and keeps this session valid (it reissues the cookie).
export function ChangePasswordForm() {
  const { user } = useAuth();
  const homeHref = user ? getRoleDestination(user.role) : "/login";

  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retry = useRetryCountdown();
  const [success, setSuccess] = useState(false);

  const senhaAtualInputRef = useRef<HTMLInputElement | null>(null);
  const novaSenhaInputRef = useRef<HTMLInputElement | null>(null);
  const confirmacaoInputRef = useRef<HTMLInputElement | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const [errorSequence, setErrorSequence] = useState(0);
  const lastErrorFocus = useRef<FocusTarget | null>(null);

  // After a failed submit, move focus to the invalid field or, for submission
  // errors, to the error summary. The sequence id re-runs the effect even when
  // the same error message is reported twice in a row.
  useEffect(() => {
    if (errorSequence === 0) return;
    if (lastErrorFocus.current === "senhaAtual") {
      senhaAtualInputRef.current?.focus();
    } else if (lastErrorFocus.current === "novaSenha") {
      novaSenhaInputRef.current?.focus();
    } else if (lastErrorFocus.current === "confirmacao") {
      confirmacaoInputRef.current?.focus();
    } else {
      errorAlertRef.current?.focus();
    }
  }, [errorSequence]);

  function reportError(message: string, focus: FocusTarget | null = null) {
    lastErrorFocus.current = focus;
    setError(message);
    setErrorSequence((n) => n + 1);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!senhaAtual) {
      reportError("Informe sua senha atual.", "senhaAtual");
      return;
    }

    const novaSenhaError = validatePassword(novaSenha);
    if (novaSenhaError) {
      reportError(novaSenhaError, "novaSenha");
      return;
    }

    if (novaSenha !== confirmacao) {
      reportError("As senhas não coincidem.", "confirmacao");
      return;
    }

    setLoading(true);

    try {
      await changePassword({ senhaAtual, novaSenha });
      setSuccess(true);
    } catch (err) {
      retry.observe(err);
      // The new password already passed the client rules; the backend names the
      // rejected field in the 400 validation problem.
      const fields = err instanceof ApiError && err.status === 400 ? err.problem?.errors : undefined;
      if (fields?.senhaAtual) {
        reportError("A senha atual está incorreta.", "senhaAtual");
      } else if (fields?.novaSenha) {
        reportError("A nova senha não atende aos requisitos de segurança.", "novaSenha");
      } else {
        reportError(
          getAuthErrorMessage(err, {
            fallback: "Não foi possível alterar a senha. Tente novamente.",
          }),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthResultPage
        eyebrow={EYEBROW}
        title="Senha alterada"
        severity="success"
        message="Sua senha foi alterada. Você continua conectado neste dispositivo; as demais sessões foram encerradas."
        actionHref={homeHref}
        actionLabel="Voltar à minha área"
      />
    );
  }

  return (
    <AuthFormPage
      eyebrow={EYEBROW}
      title="Alterar senha"
      subtitle="Informe sua senha atual e escolha uma nova"
      onSubmit={handleSubmit}
      ariaBusy={loading}
      shakeKey={errorSequence}
      footer={<AuthFooterLink href={homeHref}>Voltar à minha área</AuthFooterLink>}
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
        id="senhaAtual"
        name="senhaAtual"
        label="Senha atual"
        autoComplete="current-password"
        value={senhaAtual}
        onChange={(e) => setSenhaAtual(e.target.value)}
        inputRef={senhaAtualInputRef}
        disabled={loading}
      />

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

      <AuthSubmitButton loading={loading} retry={retry} loadingLabel="Alterando...">
        Alterar senha
      </AuthSubmitButton>
    </AuthFormPage>
  );
}
