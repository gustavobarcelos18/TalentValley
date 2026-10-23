"use client";

import { useId, useRef, type FormEvent, type ReactNode } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { brandWash } from "@/components/common/surfaceGradient";

interface FormDialogProps {
  title: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  saving: boolean;
  error: string | null;
  children: ReactNode;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
  /** After a save attempt, moves focus to the first field marked invalid (aria-invalid). */
  focusFirstInvalid?: boolean;
}

/** TextField props that show `message` under the field only after the user tried to save. */
export function fieldError(message: string | null, attempted: boolean) {
  const shown = attempted ? message : null;
  return { error: shown !== null, helperText: shown };
}

// Shared editing dialog for profile sections. It owns the MUI Dialog so the
// title is announced to assistive technology, closing is blocked while a save is
// pending, and duplicate submissions are ignored. Each section mounts it only
// while open, so every edit starts from the current profile values.
export function FormDialog({
  title,
  onClose,
  onSubmit,
  saving,
  error,
  children,
  maxWidth = "sm",
  focusFirstInvalid = false,
}: FormDialogProps) {
  const titleId = useId();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    onSubmit(event);
    // The errors are rendered by the next frame, so look for the invalid field only then.
    if (focusFirstInvalid) {
      requestAnimationFrame(() =>
        formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]:not([aria-hidden="true"])')?.focus(),
      );
    }
  }

  return (
    <Dialog
      open
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth={maxWidth}
      aria-labelledby={titleId}
    >
      <Box component="form" ref={formRef} onSubmit={handleSubmit} noValidate>
        <DialogTitle id={titleId} sx={(theme) => ({ backgroundImage: brandWash(theme) })}>
          {title}
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: "divider" }}>
          {error && (
            <Alert severity="error" role="alert" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {children}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
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
    </Dialog>
  );
}
