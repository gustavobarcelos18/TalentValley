"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { adminApi } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";

export function AdminStudentDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.deleteStudent(id);
      router.push("/admin/alunos");
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Não foi possível excluir o aluno."));
      setBusy(false);
    }
  };

  return <><Button color="error" variant="outlined" onClick={() => setOpen(true)}>Excluir</Button><Dialog open={open} onClose={busy ? undefined : () => setOpen(false)} fullWidth maxWidth="xs"><DialogTitle>Excluir aluno permanentemente?</DialogTitle><DialogContent><Typography>Esta ação excluirá permanentemente o aluno e seus dados. Ela não pode ser desfeita.</Typography>{error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}</DialogContent><DialogActions><Button disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button><Button color="error" variant="contained" disabled={busy} onClick={() => void remove()}>{busy ? "Excluindo..." : "Excluir permanentemente"}</Button></DialogActions></Dialog></>;
}
