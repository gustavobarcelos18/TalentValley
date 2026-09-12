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
import { resetPassword } from "@/lib/auth";
import {
  PASSWORD_HELPER_TEXT,
  validatePassword,
} from "@/lib/validation";

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <RedefinirSenhaContent />
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

function RedefinirSenhaContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const missingParams = !email || !token;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const senhaError = validatePassword(novaSenha);
    if (senhaError) {
      setError(senhaError);
      return;
    }

    if (novaSenha !== confirmacao) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      await resetPassword({ email, token, novaSenha });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 400
            ? "Não foi possível redefinir a senha. Verifique o link."
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
                  Redefinir senha
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Digite sua nova senha
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

                  <PasswordField
                    id="novaSenha"
                    label="Nova senha"
                    value={novaSenha}
                    onChange={setNovaSenha}
                    showPassword={showPassword}
                    onTogglePassword={() => setShowPassword((v) => !v)}
                    disabled={loading}
                    helperText={PASSWORD_HELPER_TEXT}
                  />

                  <TextField
                    id="confirmacao"
                    name="confirmacao"
                    label="Confirmar nova senha"
                    type="password"
                    autoComplete="new-password"
                    required
                    fullWidth
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    disabled={loading}
                    slotProps={{ htmlInput: { "aria-label": "Confirmar nova senha" } }}
                  />

                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    fullWidth
                    disabled={loading}
                  >
                    {loading ? "Redefinindo..." : "Redefinir senha"}
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
              Este link de redefinição é inválido ou está incompleto. Solicite um novo.
            </Typography>
            <Button
              component={Link}
              href="/esqueci-senha"
              variant="contained"
              size="large"
              fullWidth
            >
              Solicitar novo link
            </Button>
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
        Sua senha foi redefinida com sucesso.
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

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onTogglePassword: () => void;
  disabled?: boolean;
  helperText?: string;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  showPassword,
  onTogglePassword,
  disabled,
  helperText,
}: PasswordFieldProps) {
  const visibilityIcon = showPassword ? <VisibilityOff /> : <Visibility />;
  const ariaLabel = showPassword ? "Ocultar senha" : "Mostrar senha";
  const inputType = showPassword ? "text" : "password";

  return (
    <TextField
      id={id}
      name={id}
      label={label}
      type={inputType}
      autoComplete="new-password"
      required
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      helperText={helperText}
      slotProps={{
        htmlInput: { "aria-label": label },
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                type="button"
                aria-label={ariaLabel}
                onClick={onTogglePassword}
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
  );
}
