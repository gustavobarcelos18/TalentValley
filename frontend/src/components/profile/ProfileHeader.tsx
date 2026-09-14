"use client";

import { useRef, useState, type ChangeEvent } from "react";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
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

function validatePhoto(file: File): string | null {
  if (!PHOTO_ACCEPTED_TYPES.has(file.type)) {
    return "Use uma foto nos formatos JPEG, PNG ou WebP.";
  }
  if (file.size > PHOTO_MAX_BYTES) {
    return "A foto deve ter no máximo 5 MB.";
  }
  return null;
}

// Profile header: protected photo (fetched with credentials and rendered as an
// object URL), identity and last update. Photo upload/replace/remove live here.
export function ProfileHeader({ profile, onChanged, notify }: SectionProps) {
  const dados = profile.dadosBasicos;
  const { url, loading, reload } = useProtectedFile(dados.fotoUrl);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickFile() {
    inputRef.current?.click();
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const validation = validatePhoto(file);
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
      .finally(() => setRemoving(false));
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
            size="small"
            aria-label="Alterar foto de perfil"
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
            sx={{ fontWeight: 700, textAlign: { xs: "center", sm: "left" } }}
          >
                        {dados.nomeCompleto}
          </Typography>
          <Stack
            direction="row"
            spacing={0.5}
            sx={{ justifyContent: { xs: "center", sm: "flex-start" } }}
          >
            <PlaceOutlined fontSize="small" sx={{ color: "text.secondary" }} />
            <Typography variant="body2" color="text.secondary">
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
              onClick={handleRemove}
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
          {error && (
            <Typography role="alert" variant="caption" color="error">
              {error}
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
    </Paper>
  );
}
