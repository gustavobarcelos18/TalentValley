"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { LoginLayout } from "@/components/auth/LoginLayout";
import { LoginSuspenseFallback } from "@/components/auth/LoginSuspenseFallback";
import { GuestOnly } from "@/components/auth/GuestOnly";
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import { login } from "@/lib/auth";
import {
  normalizeEmailInput,
  stripEmoji,
  stripEmojiOnPaste,
  validateEmail,
} from "@/lib/validation";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSuspenseFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginCompleted } = useAuth();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const senhaInputRef = useRef<HTMLInputElement | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const [errorSequence, setErrorSequence] = useState(0);
  const lastErrorFocus = useRef<"email" | "senha" | null>(null);

  const returnUrl = searchParams.get("returnUrl");

  const visibilityIcon = showPassword ? <VisibilityOff /> : <Visibility />;

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
      if (err instanceof ApiError) {
        switch (err.status) {
          case 401:
            reportError("E-mail ou senha incorretos.");
            break;
          case 403:
            reportError("Acesso indisponível para esta conta.");
            break;
          case 423:
            reportError(
              "Conta temporariamente bloqueada. Tente novamente mais tarde.",
            );
            break;
          default:
            reportError("Não foi possível fazer login. Tente novamente.");
        }
      } else {
        reportError("Não foi possível conectar ao servidor. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <GuestOnly>
      <LoginLayout
        title="Entrar no Talent Valley"
        subtitle="Acesse sua conta para continuar"
        onSubmit={handleSubmit}
        ariaBusy={loading}
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

        <TextField
          id="email"
          name="email"
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          fullWidth
          value={email}
          onChange={(e) => setEmail(stripEmoji(e.target.value).slice(0, 254))}
          inputRef={emailInputRef}
          disabled={loading}
          slotProps={{
            htmlInput: { "aria-label": "E-mail", onPaste: stripEmojiOnPaste },
          }}
        />

        <TextField
          id="senha"
          name="senha"
          label="Senha"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          required
          fullWidth
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          inputRef={senhaInputRef}
          disabled={loading}
          slotProps={{
            htmlInput: { "aria-label": "Senha" },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    onClick={() => setShowPassword((v) => !v)}
                    edge="end"
                  >
                    {visibilityIcon}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
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

        <Button
          type="submit"
          variant="contained"
          size="large"
          fullWidth
          disabled={loading}
        >
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </LoginLayout>
    </GuestOnly>
  );
}

function isValidLocalRedirect(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}