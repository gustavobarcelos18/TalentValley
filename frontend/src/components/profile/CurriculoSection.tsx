"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";
import PictureAsPdfOutlined from "@mui/icons-material/PictureAsPdfOutlined";
import UploadFileOutlined from "@mui/icons-material/UploadFileOutlined";
import { apiDownload, getApiErrorMessage } from "@/lib/api";
import {
  deleteStudentCurriculum,
  uploadStudentCurriculum,
} from "@/lib/student";
import type { SectionProps } from "./sectionProps";

const CURRICULO_MAX_BYTES = 10 * 1024 * 1024;

async function validatePdf(file: File): Promise<string | null> {
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return "Envie um arquivo PDF.";
  }
  if (file.type && file.type !== "application/pdf") {
    return "O arquivo selecionado não é um PDF válido.";
  }
  if (file.size === 0) {
    return "O arquivo PDF está vazio.";
  }
  if (file.size > CURRICULO_MAX_BYTES) {
    return "O currículo deve ter no máximo 10 MB.";
  }
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (signature.length !== 5 || new TextDecoder().decode(signature) !== "%PDF-") {
    return "O arquivo selecionado não é um PDF válido.";
  }
  return null;
}

// Curriculum section. Presence comes from the backend (possuiCurriculo); the
// download is protected, so bytes are fetched with credentials and handed to
// the browser through a temporary object URL.
export function CurriculoSection({ profile, onChanged, notify }: SectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const possuiCurriculo = profile.curriculo.possuiCurriculo;

  const busy = uploading || downloading || deleting;

  function pickFile() {
    inputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const validation = await validatePdf(file);
      if (validation) {
        setError(validation);
        return;
      }
      await uploadStudentCurriculum(file);
      onChanged();
      notify("Currículo enviado.");
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Não foi possível enviar o currículo. Tente novamente."
        )
      );
    } finally {
      setUploading(false);
    }
  }

  function handleDownload() {
    setError(null);
    setDownloading(true);
    apiDownload("/api/alunos/me/curriculo")
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "curriculo.pdf";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        setError(
          getApiErrorMessage(
            err,
            "Não foi possível baixar o currículo. Tente novamente."
          )
        );
      })
      .finally(() => setDownloading(false));
  }

  function openDeleteConfirmation() {
    setConfirmOpen(true);
  }

  function closeDeleteConfirmation() {
    setConfirmOpen(false);
  }

  function handleDelete() {
    setError(null);
    setDeleting(true);
    deleteStudentCurriculum()
      .then(() => {
        onChanged();
        notify("Currículo removido.");
      })
      .catch((err) => {
        setError(
          getApiErrorMessage(
            err,
            "Não foi possível remover o currículo. Tente novamente."
          )
        );
      })
      .finally(() => {
        setDeleting(false);
        setConfirmOpen(false);
      });
  }

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ p: { xs: 2.5, sm: 3 }, border: 1, borderColor: "divider" }}
    >
      <Stack
        direction="row"
        spacing={2}
      >
        <Typography component="h2" variant="h6">
          Currículo
        </Typography>
      </Stack>

      <Stack spacing={2} sx={{ mt: 2 }}>
        {error && (
          <Alert severity="error" role="alert">
            {error}
          </Alert>
        )}

        {possuiCurriculo ? (
          <>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              sx={{
                alignItems: { sm: "center" },
                p: 2,
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: "action.hover",
              }}
            >
              <Stack direction="row" spacing={1.5}>
                <PictureAsPdfOutlined sx={{ color: "error.main" }} />
                <Stack>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Currículo em PDF
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Arquivo protegido, visível apenas para você e recrutadores
                    autorizados.
                  </Typography>
                </Stack>
              </Stack>
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  downloading ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <DownloadOutlined />
                  )
                }
                onClick={handleDownload}
                disabled={busy}
              >
                Baixar
              </Button>
            </Stack>
            <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
              <Button
                size="small"
                startIcon={<UploadFileOutlined />}
                onClick={pickFile}
                disabled={busy}
              >
                Substituir
              </Button>
              <Button
                size="small"
                color="error"
                startIcon={<DeleteOutlined />}
                onClick={openDeleteConfirmation}
                disabled={busy}
              >
                Excluir
              </Button>
            </Stack>
          </>
        ) : (
          <Stack
            spacing={1.5}
            sx={{
              p: 3,
              border: 1,
              borderStyle: "dashed",
              borderColor: "divider",
              borderRadius: 2,
              alignItems: "center",
            }}
          >
            <PictureAsPdfOutlined sx={{ color: "text.secondary", fontSize: 32 }} />
            <Typography variant="body2" color="text.secondary">
              Nenhum currículo enviado ainda. Envie seu PDF (máx. 10 MB).
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<UploadFileOutlined />}
              onClick={pickFile}
              disabled={busy}
            >
              Enviar currículo
            </Button>
          </Stack>
        )}

        {uploading && (
          <Typography variant="caption" color="text.secondary">
            Enviando currículo...
          </Typography>
        )}
      </Stack>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        onChange={handleFileChange}
        hidden
        aria-label="Selecionar currículo em PDF"
      />

      <Dialog
        open={confirmOpen}
        onClose={deleting ? undefined : closeDeleteConfirmation}
        aria-labelledby="curriculo-delete-dialog-title"
      >
        <DialogTitle id="curriculo-delete-dialog-title">
          Excluir currículo?
        </DialogTitle>
        <DialogContent>
          <Typography>
            O currículo atual será removido do seu perfil. Você poderá enviar
            outro arquivo depois.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteConfirmation} disabled={deleting}>
            Cancelar
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
            variant="contained"
            disabled={deleting}
          >
            {deleting ? "Excluindo..." : "Excluir currículo"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
