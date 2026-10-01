"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/api";
import { deleteOwnAccount } from "@/lib/student";

const REDIRECT_DELAY_MS = 2000;

// LGPD self-deletion zone. The backend verifies the password (400 wrong, 423 locked)
// and removes the account; the UI only collects the confirmation.
export function ExclusaoSection() {
  const router = useRouter();
  const { logout } = useAuth();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleted, setDeleted] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function close() {
    if (busy) return;
    setOpen(false);
    setPassword("");
    setError(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!password) {
      setError("Informe sua senha para confirmar.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteOwnAccount(password);
      setPassword("");
      setOpen(false);
      setDeleted(true);
      timer.current = setTimeout(() => {
        router.replace("/login");
        // The server already cleared the cookie; this only resets client auth state.
        logout().catch(() => undefined);
      }, REDIRECT_DELAY_MS);
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Não foi possível excluir a conta. Tente novamente."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Paper
      component="section"
      elevation={0}
      aria-labelledby={`${titleId}-section`}
      sx={{ p: { xs: 2.5, sm: 3 }, border: 1, borderColor: "error.main" }}
    >
      <Stack spacing={2}>
        <Typography id={`${titleId}-section`} component="h2" variant="h6" color="error">
          Excluir conta
        </Typography>
        {deleted ? (
          <Alert severity="success" role="status">
            Sua conta foi deletada com sucesso. Redirecionando...
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary">
              Esta ação é irreversível. Todos os seus dados, formações e projetos serão
              permanentemente deletados.
            </Typography>
            <Box>
              <Button color="error" variant="outlined" onClick={() => setOpen(true)}>
                Excluir minha conta
              </Button>
            </Box>
          </>
        )}
      </Stack>

      <Dialog open={open} onClose={close} fullWidth maxWidth="xs" aria-labelledby={titleId}>
        <Box component="form" onSubmit={submit} noValidate autoComplete="off">
          <DialogTitle id={titleId}>Excluir minha conta</DialogTitle>
          <DialogContent>
            {error && (
              <Alert severity="error" role="alert" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <DialogContentText sx={{ mb: 2 }}>
              Digite sua senha para confirmar a exclusão definitiva da sua conta.
            </DialogContentText>
            <TextField
              autoFocus
              fullWidth
              required
              type="password"
              label="Senha atual"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={busy}
              slotProps={{ htmlInput: { autoComplete: "off", maxLength: 1024 } }}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button type="button" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="submit"
              color="error"
              variant="contained"
              disabled={busy}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {busy ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Paper>
  );
}
