"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import { AuthField } from "@/components/auth/AuthField";
import { AuthFormPage } from "@/components/auth/AuthFormPage";
import { PasswordField } from "@/components/auth/PasswordField";
import { useAuth } from "@/hooks/useAuth";
import { login } from "@/lib/auth";
import { getAuthErrorMessage } from "@/lib/authErrors";
import {
  normalizeEmailInput,
  stripEmoji,
  stripEmojiOnPaste,
  validateEmail,
} from "@/lib/validation";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <Stack spacing={2} role="status" aria-live="polite" sx={{ alignItems: "center", py: 8 }}>
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        Carregando...
      </Typography>
    </Stack>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginCompleted } = useAuth();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const senhaInputRef = useRef<HTMLInputElement | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const [errorSequence, setErrorSequence] = useState(0);
  const lastErrorFocus = useRef<"email" | "senha" | null>(null);

  const returnUrl = searchParams.get("returnUrl");
  const sessionExpired = searchParams.get("sessao") === "expirada";

  // After a failed submit, move focus to the first invalid field or, for
  // submission errors, to the error summary. The sequence id re-runs the
  // effect even when the same error message is reported twice in a row.
  useEffect(() => {
    if (errorSequence === 0) return;
    if (lastErrorFocus.current === "email") {
      emailInputRef.current?.focus();
    } else if (lastErrorFocus.current === "senha") {
      senhaInputRef.current?.focus();
    } else {
      errorAlertRef.current?.focus();
    }
  }, [errorSequence]);

  function reportError(message: string, focus: "email" | "senha" | null = null) {
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

    if (!senha) {
      reportError("Informe sua senha.", "senha");
      return;
    }

    setLoading(true);

    try {
      const response = await login({
        email: normalizeEmailInput(email),
        senha,
      });
      loginCompleted(response.usuario);

      const destination =
        returnUrl && isValidLocalRedirect(returnUrl)
          ? returnUrl
          : response.destinoInicial;

      router.replace(destination);
    } catch (err) {
      reportError(
        getAuthErrorMessage(err, {
          fallback: "Não foi possível fazer login. Tente novamente.",
          overrides: { 401: "E-mail ou senha incorretos." },
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormPage
      title="Entrar no Talent Valley"
      subtitle="Acesse sua conta para continuar"
      onSubmit={handleSubmit}
      ariaBusy={loading}
      footer={<LoginFooter />}
    >
      {sessionExpired && !error && (
        <Alert severity="info" sx={{ fontSize: "0.875rem" }}>
          Sua sessão expirou. Entre novamente para continuar.
        </Alert>
      )}

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

      <PasswordField
        id="senha"
        name="senha"
        label="Senha"
        autoComplete="current-password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        inputRef={senhaInputRef}
        disabled={loading}
      />

      <Box className="text-right">
        <Typography
          component={Link}
          href="/esqueci-senha"
          variant="body2"
          sx={{
            color: "primary.main",
            fontWeight: 500,
            "&:hover": { textDecoration: "underline" },
          }}
        >
          Esqueceu sua senha?
        </Typography>
      </Box>

      <Button type="submit" variant="contained" size="large" fullWidth disabled={loading}>
        {loading ? "Entrando..." : "Entrar"}
      </Button>
    </AuthFormPage>
  );
}

function LoginFooter() {
  return (
    <>
      <Typography align="center" variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        Ainda não possui acesso?{" "}
        <Typography
          component={Link}
          href="/cadastro"
          variant="body2"
          sx={{
            color: "primary.main",
            fontWeight: 600,
            "&:hover": { textDecoration: "underline" },
          }}
        >
          Solicitar cadastro
        </Typography>
      </Typography>

      <Box sx={{ textAlign: "center", mt: 4 }}>
        <Typography
          component={Link}
          href="/"
          variant="body2"
          sx={{
            color: "text.secondary",
            display: "inline-flex",
            alignItems: "center",
            gap: 0.75,
            transition: "color 0.2s",
            "&:hover": { color: "text.primary" },
          }}
        >
          <ArrowBack sx={{ fontSize: "1rem" }} />
          Voltar para o início
        </Typography>
      </Box>
    </>
  );
}

function isValidLocalRedirect(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}
