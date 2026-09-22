"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { GuestOnly } from "@/components/auth/GuestOnly";
import { ApiError } from "@/lib/api";
import { forgotPassword } from "@/lib/auth";
import { normalizeEmailInput, validateEmail } from "@/lib/validation";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const successAlertRef = useRef<HTMLDivElement | null>(null);
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

  // Move focus to the success message once the form is replaced by it.
  useEffect(() => {
    if (submitted) {
      successAlertRef.current?.focus();
    }
  }, [submitted]);

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
      if (err instanceof ApiError && err.status >= 500) {
        reportError(
          "Não foi possível processar sua solicitação. Tente novamente.",
        );
      } else {
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <GuestOnly>
      <AuthPageShell
        title="Esqueci minha senha"
        subtitle="Informe seu e-mail para receber as instruções de redefinição"
        onSubmit={submitted ? undefined : handleSubmit}
        ariaBusy={loading}
      >
        {submitted ? (
          <Stack spacing={3}>
            <Alert
              ref={successAlertRef}
              tabIndex={-1}
              severity="success"
              variant="filled"
              sx={{ fontSize: "0.9375rem" }}
            >
              Se a conta for elegível, enviaremos as instruções para redefinir sua senha.
            </Alert>
            <Button
              component={Link}
              href="/login"
              variant="contained"
              size="large"
              fullWidth
            >
              Voltar ao login
            </Button>
          </Stack>
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
              id="email"
              name="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              required
              fullWidth
              value={email}
              onChange={(e) => setEmail(e.target.value.slice(0, 254))}
              inputRef={emailInputRef}
              disabled={loading}
              slotProps={{ htmlInput: { "aria-label": "E-mail" } }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={loading}
            >
              {loading ? "Enviando..." : "Enviar instruções"}
            </Button>

            <Box sx={{ textAlign: "center" }}>
              <Typography
                component={Link}
                href="/login"
                variant="body2"
                sx={{
                  color: "primary.main",
                  fontWeight: 500,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Voltar ao login
              </Typography>
            </Box>
          </>
        )}
      </AuthPageShell>
    </GuestOnly>
  );
}
