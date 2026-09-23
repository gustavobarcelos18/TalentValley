"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { AuthSuspenseFallback } from "@/components/auth/AuthSuspenseFallback";
import { GuestOnly } from "@/components/auth/GuestOnly";
import { ApiError } from "@/lib/api";
import { activateAccount } from "@/lib/auth";
import {
  PASSWORD_HELPER_TEXT,
  validatePassword,
} from "@/lib/validation";

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmacao, setShowConfirmacao] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const senhaInputRef = useRef<HTMLInputElement | null>(null);
  const confirmacaoInputRef = useRef<HTMLInputElement | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const [errorSequence, setErrorSequence] = useState(0);
  const lastErrorFocus = useRef<"senha" | "confirmacao" | null>(null);

  const missingParams = !email || !token;

  const visibilityIcon = showPassword ? <VisibilityOff /> : <Visibility />;
  const passwordAriaLabel = showPassword ? "Ocultar senha" : "Mostrar senha";
  const confirmacaoVisibilityIcon = showConfirmacao ? (
    <VisibilityOff />
  ) : (
    <Visibility />
  );
  const confirmacaoAriaLabel = showConfirmacao
    ? "Ocultar confirmação de senha"
    : "Mostrar confirmação de senha";

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
      if (err instanceof ApiError) {
        reportError(
          err.status === 400
            ? "Não foi possível ativar a conta. Verifique o link."
            : "Não foi possível processar. Tente novamente.",
        );
      } else {
        reportError("Não foi possível conectar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (missingParams) {
    return (
      <GuestOnly>
        <InvalidLinkState />
      </GuestOnly>
    );
  }

  return (
    <GuestOnly>
      <AuthPageShell
        title="Ativar conta"
        subtitle="Defina sua senha para ativar seu acesso"
        onSubmit={success ? undefined : handleSubmit}
        ariaBusy={loading}
      >
        {success ? (
          <SuccessState />
        ) : (
          <>
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
              id="senha"
              name="senha"
              label="Senha"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              fullWidth
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              inputRef={senhaInputRef}
              disabled={loading}
              helperText={PASSWORD_HELPER_TEXT}
              slotProps={{
                htmlInput: { "aria-label": "Senha" },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        type="button"
                        aria-label={passwordAriaLabel}
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

            <TextField
              id="confirmacao"
              name="confirmacao"
              label="Confirmar senha"
              type={showConfirmacao ? "text" : "password"}
              autoComplete="new-password"
              required
              fullWidth
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              inputRef={confirmacaoInputRef}
              disabled={loading}
              slotProps={{
                htmlInput: { "aria-label": "Confirmar senha" },
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        type="button"
                        aria-label={confirmacaoAriaLabel}
                        onClick={() => setShowConfirmacao((v) => !v)}
                        edge="end"
                      >
                        {confirmacaoVisibilityIcon}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={loading}
            >
              {loading ? "Ativando..." : "Ativar minha conta"}
            </Button>
          </>
        )}
      </AuthPageShell>
    </GuestOnly>
  );
}

function InvalidLinkState() {
  return (
    <AuthPageShell title="Link inválido">
      <Stack spacing={3} sx={{ textAlign: "center" }}>
        <Alert severity="error" variant="filled" sx={{ fontSize: "0.875rem" }}>
          Este link de ativação é inválido ou está incompleto. Solicite um novo.
        </Alert>
        <Button
          component={Link}
          href="/login"
          variant="contained"
          size="large"
          fullWidth
        >
          Ir para o login
        </Button>
      </Stack>
    </AuthPageShell>
  );
}

function SuccessState() {
  const alertRef = useRef<HTMLDivElement | null>(null);

  // Move focus to the success message when the form is replaced by it.
  useEffect(() => {
    alertRef.current?.focus();
  }, []);

  return (
    <Stack spacing={3}>
      <Alert
        ref={alertRef}
        tabIndex={-1}
        severity="success"
        variant="filled"
        sx={{ fontSize: "0.9375rem" }}
      >
        Conta ativada com sucesso! Você já pode fazer login.
      </Alert>
      <Button
        component={Link}
        href="/login"
        variant="contained"
        size="large"
        fullWidth
      >
        Ir para o login
      </Button>
    </Stack>
  );
}
