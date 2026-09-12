"use client";

import { Button, Container, Paper, Stack, Typography } from "@mui/material";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";

export default function AdminPage() {
  const { user, logout } = useAuth();

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <main className="flex min-h-screen items-center bg-gradient-to-br from-zinc-50 to-violet-50 px-4 py-12 dark:from-zinc-950 dark:to-zinc-900">
        <Container maxWidth="sm">
          <Paper elevation={0} className="border border-zinc-200 p-8 dark:border-zinc-800">
            <Stack spacing={3}>
              <Stack spacing={1}>
                <Typography component="h1" variant="h5">
                  Painel Administrativo
                </Typography>
                <Typography color="text.secondary">
                  Área do administrador — em construção
                </Typography>
              </Stack>

              {user && (
                <Stack spacing={1} className="rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
                  <Typography variant="body2">
                    <strong>Nome:</strong> {user.nome}
                  </Typography>
                  <Typography variant="body2">
                    <strong>E-mail:</strong> {user.email}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Perfil:</strong> {user.role}
                  </Typography>
                </Stack>
              )}

              <Button
                variant="outlined"
                color="primary"
                onClick={() => logout()}
                className="self-start"
              >
                Sair
              </Button>
            </Stack>
          </Paper>
        </Container>
      </main>
    </ProtectedRoute>
  );
}
