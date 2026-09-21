"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { GuestOnly } from "@/components/auth/GuestOnly";
import { ApiError } from "@/lib/api";
import { forgotPassword } from "@/lib/auth";
import { normalizeEmailInput, validateEmail } from "@/lib/validation";

export default function EsqueciSenhaPage() {
  const theme = useTheme();
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
        className="flex min-h-screen items-center px-4 py-12"
        sx={{
          backgroundColor:
            theme.palette.mode === "dark"
              ? "rgba(10,18,20,0.62)"
              : "rgba(255,255,255,0.55)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <Container maxWidth="xs">
          <Paper
            component={submitted ? "div" : "form"}
            onSubmit={submitted ? undefined : handleSubmit}
            elevation={0}
            noValidate
            sx={{
              border: 1,
              borderColor: "divider",
              p: 5,
              bgcolor: "background.paper",
            }}
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
                  <Alert severity="success" variant="filled" sx={{ fontSize: "0.9375rem" }}>
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
                    <Alert severity="error" variant="filled" sx={{ fontSize: "0.875rem" }}>
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
            </Stack>
          </Paper>
        </Container>
      </Box>
    </GuestOnly>
  );
}
