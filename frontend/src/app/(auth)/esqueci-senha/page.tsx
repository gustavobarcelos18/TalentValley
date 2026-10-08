"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@mui/material";
import { AuthField } from "@/components/auth/AuthField";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import { useRetryCountdown } from "@/components/auth/motion/useRetryCountdown";
import { AuthFooterLink } from "@/components/auth/AuthFooterLink";
import { AuthFormPage } from "@/components/auth/AuthFormPage";
import { AuthResultPage } from "@/components/auth/AuthResultPage";
import { ApiError } from "@/lib/api";
import { forgotPassword } from "@/lib/auth";
import { getAuthErrorMessage } from "@/lib/authErrors";
import {
  normalizeEmailInput,
  stripEmoji,
  stripEmojiOnPaste,
  validateEmail,
} from "@/lib/validation";

const EYEBROW = "RECUPERAR ACESSO";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retry = useRetryCountdown();

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const [errorSequence, setErrorSequence] = useState(0);
  const lastErrorFocus = useRef<"email" | null>(null);

  // After a failed submit, move focus to the invalid e-mail field or to the
  // error summary. The sequence id re-runs the effect even when the same
  // error message is reported twice in a row.
  useEffect(() => {
    if (errorSequence === 0) return;
    if (lastErrorFocus.current === "email") {
      emailInputRef.current?.focus();
    } else {
      errorAlertRef.current?.focus();
    }
  }, [errorSequence]);

  function reportError(message: string, focus: "email" | null = null) {
    lastErrorFocus.current = focus;
    setError(message);
    setErrorSequence((n) => n + 1);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const emailError = validateEmail(email.trim());
    if (emailError) {
      reportError(emailError, "email");
      return;
    }

    setLoading(true);

    try {
      await forgotPassword(normalizeEmailInput(email));
      setSubmitted(true);
    } catch (err) {
      retry.observe(err);
      // Client errors other than rate limiting get the same neutral success
      // screen, so the answer never reveals whether the account exists.
      if (err instanceof ApiError && err.status < 500 && err.status !== 429) {
        setSubmitted(true);
      } else {
        reportError(
          getAuthErrorMessage(err, {
            fallback: "Não foi possível processar sua solicitação. Tente novamente.",
          }),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <AuthResultPage
        eyebrow={EYEBROW}
        title="Verifique seu e-mail"
        severity="success"
        message="Se a conta for elegível, enviaremos as instruções para redefinir sua senha."
        actionHref="/login"
        actionLabel="Voltar ao login"
      />
    );
  }

  return (
    <AuthFormPage
      eyebrow={EYEBROW}
      title="Esqueci minha senha"
      subtitle="Informe seu e-mail para receber as instruções de redefinição"
      onSubmit={handleSubmit}
      ariaBusy={loading}
      shakeKey={errorSequence}
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

      <AuthField
        id="email"
        name="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(stripEmoji(e.target.value).slice(0, 254))}
        onPaste={stripEmojiOnPaste}
        inputRef={emailInputRef}
        disabled={loading}
      />

      <AuthSubmitButton loading={loading} retry={retry} loadingLabel="Enviando...">
        Enviar instruções
      </AuthSubmitButton>
    </AuthFormPage>
  );
}
