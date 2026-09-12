"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Box,
  Button,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { GuestOnly } from "@/components/auth/GuestOnly";
import { ApiError } from "@/lib/api";
import { activateAccount } from "@/lib/auth";
import {
  PASSWORD_HELPER_TEXT,
  validatePassword,
} from "@/lib/validation";

export default function AtivarContaPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <AtivarContaContent />
    </Suspense>
  );
}

function PageFallback() {
  return (
    <Box
      component="main"
      className="flex min-h-screen items-center bg-gradient-to-br from-zinc-50 to-violet-50 px-4 py-12 dark:from-zinc-950 dark:to-zinc-900"
    />
  );
}

function AtivarContaContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const missingParams = !email || !token;

  const visibilityIcon = showPassword ? <VisibilityOff /> : <Visibility />;
  const passwordAriaLabel = showPassword ? "Ocultar senha" : "Mostrar senha";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const senhaError = validatePassword(senha);
    if (senhaError) {
      setError(senhaError);
      return;
    }

    if (senha !== confirmacao) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      await activateAccount({ email, token, senha });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 400
            ? "Não foi possível ativar a conta. Verifique o link."
            : "Não foi possível processar. Tente novamente."
        );
      } else {
        setError("Não foi possível conectar. Tente novamente.");
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
      <Box
        component="main"
        className="flex min-h-screen items-center bg-gradient-to-br from-zinc-50 to-violet-50 px-4 py-12 dark:from-zinc-950 dark:to-zinc-900"
      >
        <Container maxWidth="xs">
          <Paper
            component={success ? "div" : "form"}
            onSubmit={success ? undefined : handleSubmit}
            elevation={0}
            className="border border-zinc-200 p-8 dark:border-zinc-800"
            noValidate
          >
            <Stack spacing={3}>
              <Stack spacing={1} sx={{ textAlign: "center" }}>
                <Typography component="h1" variant="h5">
                  Ativar conta
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Defina sua senha para ativar seu acesso
                </Typography>
              </Stack>

              {success ? (
                <SuccessState />
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
                    id="senha"
                    name="senha"
                    label="Senha"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    fullWidth
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
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
                              tabIndex={-1}
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
                    type="password"
                    autoComplete="new-password"
                    required
                    fullWidth
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    disabled={loading}
                    slotProps={{ htmlInput: { "aria-label": "Confirmar senha" } }}
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
            </Stack>
          </Paper>
        </Container>
      </Box>
    </GuestOnly>
  );
}

function InvalidLinkState() {
  return (
    <Box
      component="main"
      className="flex min-h-screen items-center bg-gradient-to-br from-zinc-50 to-violet-50 px-4 py-12 dark:from-zinc-950 dark:to-zinc-900"
    >
      <Container maxWidth="xs">
        <Paper elevation={0} className="border border-zinc-200 p-8 dark:border-zinc-800">
          <Stack spacing={3} sx={{ textAlign: "center" }}>
            <Typography component="h1" variant="h5">
              Link inválido
            </Typography>
            <Typography color="text.secondary">
              Este link de ativação é inválido ou está incompleto. Solicite um novo.
            </Typography>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}

function SuccessState() {
  return (
    <Stack spacing={3}>
      <Typography
        role="status"
        variant="body1"
        align="center"
        className="rounded-lg bg-green-50 px-3 py-3 text-green-800 dark:bg-green-950 dark:text-green-200"
      >
        Conta ativada com sucesso! Você já pode fazer login.
      </Typography>
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
