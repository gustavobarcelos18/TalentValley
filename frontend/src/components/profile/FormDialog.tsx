"use client";

import type { FormEvent, ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";

interface FormDialogProps {
  title: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  saving: boolean;
  error: string | null;
  children: ReactNode;
}

// Shared form scaffold rendered inside a MUI Dialog. The dialog component only
// mounts this while open, so every edit starts from the current profile values.
export function FormDialog({
  title,
  onClose,
  onSubmit,
  saving,
  error,
  children,
}: FormDialogProps) {
  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" role="alert" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {children}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button type="button" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={saving}
          startIcon={
            saving ? <CircularProgress size={16} color="inherit" /> : undefined
          }
        >
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </DialogActions>
    </Box>
  );
}
