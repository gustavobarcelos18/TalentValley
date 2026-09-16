"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { GuestOnly } from "@/components/auth/GuestOnly";
import { ApiError } from "@/lib/api";
import { forgotPassword } from "@/lib/auth";
import { normalizeEmailInput, validateEmail } from "@/lib/validation";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const emailError = validateEmail(email.trim());
    if (emailError) {
      setError(emailError);
      return;
    }

    setLoading(true);

    try {
      await forgotPassword(normalizeEmailInput(email));
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError && err.status >= 500) {
        setError("Não foi possível processar sua solicitação. Tente novamente.");
      } else {
        setSubmitted(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <GuestOnly>
      <Box
        component="main"
        className="flex min-h-screen items-center bg-gradient-to-br from-zinc-50 to-violet-50 px-4 py-12 dark:from-zinc-950 dark:to-zinc-900"
      >
        <Container maxWidth="xs">
          <Paper
            component={submitted ? "div" : "form"}
            onSubmit={submitted ? undefined : handleSubmit}
            elevation={0}
            className="border border-zinc-200 p-8 dark:border-zinc-800"
            noValidate
          >
            <Stack spacing={3}>
              <Stack spacing={1} sx={{ textAlign: "center" }}>
                <Typography component="h1" variant="h5">
                  Esqueci minha senha
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Informe seu e-mail para receber as instruções de redefinição
                </Typography>
              </Stack>

              {submitted ? (
                <Stack spacing={3}>
                  <Typography
                    role="status"
                    variant="body1"
                    align="center"
                    className="rounded-lg bg-green-50 px-3 py-3 text-green-800 dark:bg-green-950 dark:text-green-200"
                  >
                    Se a conta for elegível, enviaremos as instruções para redefinir sua senha.
                  </Typography>
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
                    <Typography
                      role="alert"
                      color="error"
                      variant="body2"
                      align="center"
                      className="rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950"
                    >
                      {error}
                    </Typography>
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
                    <Link
                      href="/login"
                      className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
                    >
                      Voltar ao login
                    </Link>
                  </Box>
                </>
              )}
            </Stack>
          </Paper>
        </Container>
      </Box>
    </GuestOnly>
  );
}
