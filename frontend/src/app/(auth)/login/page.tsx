"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { useAuth } from "@/hooks/useAuth";
import { ApiError } from "@/lib/api";
import { login } from "@/lib/auth";
import { normalizeEmailInput, validateEmail } from "@/lib/validation";

export default function LoginPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <LoginContent />
    </Suspense>
  );
}

function PageFallback() {
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
    />
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginCompleted } = useAuth();
  const theme = useTheme();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnUrl = searchParams.get("returnUrl");

  const visibilityIcon = showPassword ? <VisibilityOff /> : <Visibility />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const emailError = validateEmail(email.trim());
    if (emailError) {
      setError(emailError);
      return;
    }

    if (!senha) {
      setError("Informe sua senha.");
      return;
    }

    setLoading(true);

    try {
      const response = await login({ email: normalizeEmailInput(email), senha });
      loginCompleted(response.usuario);

      const destination = returnUrl && isValidLocalRedirect(returnUrl)
        ? returnUrl
        : response.destinoInicial;

      router.replace(destination);
    } catch (err) {
      if (err instanceof ApiError) {
        switch (err.status) {
          case 401:
            setError("E-mail ou senha incorretos.");
            break;
          case 403:
            setError("Acesso indisponível para esta conta.");
            break;
          case 423:
            setError("Conta temporariamente bloqueada. Tente novamente mais tarde.");
            break;
          default:
            setError("Não foi possível fazer login. Tente novamente.");
        }
      } else {
        setError("Não foi possível conectar ao servidor. Tente novamente.");
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
            component="form"
            onSubmit={handleSubmit}
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
                  Entrar no Talent Valley
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Acesse sua conta para continuar
                </Typography>
              </Stack>

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
                disabled={loading}
                slotProps={{
                  htmlInput: { "aria-label": "Senha" },
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          type="button"
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
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
              <Typography align="center" variant="body2" color="text.secondary">
                Ainda não possui acesso? <Link href="/cadastro">Solicitar cadastro</Link>
              </Typography>
            </Stack>
          </Paper>
        </Container>
      </Box>
    </GuestOnly>
  );
}

function isValidLocalRedirect(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}
