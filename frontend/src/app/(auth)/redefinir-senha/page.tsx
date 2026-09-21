"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  useTheme,
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
      className="flex min-h-screen items-center bg-linear-to-br from-zinc-50 to-violet-50 px-4 py-12 dark:from-zinc-950 dark:to-zinc-900"
    />
  );
}

function RedefinirSenhaContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";
  const theme = useTheme();

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
            component={success ? "div" : "form"}
            onSubmit={success ? undefined : handleSubmit}
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
                    <Alert severity="error" variant="filled" sx={{ fontSize: "0.875rem" }}>
                      {error}
                    </Alert>
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
  const theme = useTheme();
  return (
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
          elevation={0}
          sx={{
            border: 1,
            borderColor: "divider",
            p: 5,
            bgcolor: "background.paper",
          }}
        >
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
      <Alert severity="success" variant="filled" sx={{ fontSize: "0.9375rem" }}>
        Sua senha foi redefinida com sucesso.
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
