"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import PhotoCameraOutlined from "@mui/icons-material/PhotoCameraOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import { useProtectedFile } from "@/hooks/useProtectedFile";
import { getApiErrorMessage } from "@/lib/api";
import { formatUpdatedAt, initialsOf } from "@/lib/format";
import {
  deleteStudentPhoto,
  uploadStudentPhoto,
} from "@/lib/student";
import type { SectionProps } from "./sectionProps";

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function validatePhoto(file: File): Promise<string | null> {
  const extension = file.name.toLowerCase().split(".").pop();
  const expectedType = extension === "jpg" || extension === "jpeg"
    ? "image/jpeg"
    : extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : null;
  if (!expectedType || !PHOTO_ACCEPTED_TYPES.has(expectedType)) {
    return "Use uma foto nos formatos JPEG, PNG ou WebP.";
  }
  if (file.type !== expectedType) {
    return "O formato informado não corresponde ao arquivo de imagem selecionado.";
  }
  if (file.size === 0) {
    return "O arquivo de imagem está vazio.";
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return "A foto deve ter no máximo 5 MB.";
  }
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const validSignature = expectedType === "image/jpeg"
    ? header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff
    : expectedType === "image/png"
      ? header.length >= 8 && header.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10"
      : header.length >= 12 && header.subarray(0, 4).join("") === "RIFF" && header.subarray(8, 12).join("") === "WEBP";
  if (!validSignature) {
    return "O arquivo selecionado não é uma imagem JPEG, PNG ou WebP válida.";
  }
  return null;
}

// Profile header: protected photo (fetched with credentials and rendered as an
// object URL), identity and last update. Photo upload/replace/remove live here.
export function ProfileHeader({ profile, onChanged, notify }: SectionProps) {
  const dados = profile.dadosBasicos;
  const { url, loading, reload, error: loadError } = useProtectedFile(dados.fotoUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile() {
    inputRef.current?.click();
  }

  function openRemoveDialog() {
    setConfirmOpen(true);
  }

  function closeRemoveDialog() {
    setConfirmOpen(false);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validation = await validatePhoto(file);
    if (validation) {
      setError(validation);
      return;
    }

    setError(null);
    setUploading(true);
    uploadStudentPhoto(file)
      .then(() => {
        onChanged();
        reload();
        notify("Foto atualizada.");
      })
      .catch((err) => {
        setError(
          getApiErrorMessage(err, "Não foi possível enviar a foto. Tente novamente.")
        );
      })
      .finally(() => setUploading(false));
  }

  function handleRemove() {
    setError(null);
    setRemoving(true);
    deleteStudentPhoto()
      .then(() => {
        onChanged();
        reload();
        notify("Foto removida.");
      })
      .catch((err) => {
        setError(
          getApiErrorMessage(err, "Não foi possível remover a foto. Tente novamente.")
        );
      })
      .finally(() => {
        setRemoving(false);
        setConfirmOpen(false);
      });
  }

  const busy = uploading || removing;

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ p: { xs: 2.5, sm: 3 }, border: 1, borderColor: "divider" }}
        >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={{ xs: 2, sm: 3 }}
        sx={{ alignItems: { xs: "center", sm: "flex-start" } }}
      >
        <Box sx={{ position: "relative", flexShrink: 0 }}>
          <Avatar
            src={url ?? undefined}
            sx={{ width: 96, height: 96, fontSize: 28, fontWeight: 600 }}
          >
            {initialsOf(dados.nomeCompleto)}
          </Avatar>
          {loading && (
            <CircularProgress
              size={40}
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                mt: "-20px",
                ml: "-20px",
              }}
            />
          )}
          <IconButton
            aria-label={dados.fotoUrl ? "Alterar foto de perfil" : "Adicionar foto de perfil"}
            onClick={pickFile}
            disabled={busy}
            sx={{
              position: "absolute",
              right: -6,
              bottom: -6,
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              boxShadow: 1,
              "&:hover": { bgcolor: "background.default" },
            }}
          >
            <PhotoCameraOutlined fontSize="small" />
          </IconButton>
                </Box>

        <Stack
          spacing={0.75}
          sx={{ minWidth: 0, alignItems: { xs: "center", sm: "flex-start" } }}
        >
          <Typography
            component="h1"
            variant="h5"
            sx={{ fontWeight: 700, textAlign: { xs: "center", sm: "left" }, overflowWrap: "anywhere" }}
          >
                        {dados.nomeCompleto}
          </Typography>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ justifyContent: { xs: "center", sm: "flex-start" } }}
          >
            <PlaceOutlined fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0, overflowWrap: "anywhere" }}>
              {[dados.cidade, dados.uf].filter(Boolean).join(" - ") ||
                "Localização não informada"}
            </Typography>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Perfil atualizado em {formatUpdatedAt(profile.atualizadoEm)}
          </Typography>
          {dados.fotoUrl && (
            <Button
              size="small"
              onClick={openRemoveDialog}
              disabled={busy}
              startIcon={<DeleteOutlined />}
              sx={{
                color: "error.main",
                alignSelf: { xs: "center", sm: "flex-start" },
              }}
            >
              Remover foto
            </Button>
          )}
          {uploading && (
            <Typography variant="caption" color="text.secondary">
              Enviando foto...
            </Typography>
          )}
          {(loadError || error) && (
            <Typography role="alert" variant="caption" color="error">
              {loadError || error}
            </Typography>
          )}
        </Stack>
      </Stack>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        hidden
        aria-label="Selecionar foto de perfil"
      />

      <Dialog
        open={confirmOpen}
        onClose={removing ? undefined : closeRemoveDialog}
        aria-labelledby="remove-photo-dialog-title"
        aria-describedby="remove-photo-dialog-description"
      >
        <DialogTitle id="remove-photo-dialog-title">
          Remover foto de perfil?
        </DialogTitle>
        <DialogContent>
          <Typography id="remove-photo-dialog-description" variant="body1">
            A foto atual será removida do seu perfil. Você poderá enviar outra
            foto depois.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRemoveDialog} disabled={removing}>
            Cancelar
          </Button>
          <Button onClick={handleRemove} disabled={removing} color="error">
            {removing ? "Removendo..." : "Remover foto"}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
