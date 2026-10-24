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
  Stack,
  Typography,
} from "@mui/material";
import { EmptyState } from "@/components/common/EmptyState";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { api } from "@/lib/api";
import type { SectionProps } from "@/app/sectionProps";

const MAX_URL_LENGTH = 500;

export function CurriculoSection({ profile, onChanged, notify }: SectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lattesUrl, setLattesUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const possuiCurriculo = profile.curriculo?.possuiCurriculo ?? false;
  const urlExistente = profile.curriculo?.lattesUrl ?? null;

  // Inicializa a URL do estado do perfil
  if (urlExistente && !lattesUrl) {
    setLattesUrl(urlExistente);
  }

  function handleLattesUrlChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value.trim();
    setLattesUrl(value);
  }

  async function handleSaveLattesUrl() {
    if (!lattesUrl) {
      setError("URL do Lattes é obrigatória");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const response = await fetch("/api/alunos/me/curriculo/lattes", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ lattesUrl }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || "Erro ao salvar URL do Lattes");
        return;
      }

      await onChanged();
      notify("URL do Lattes atualizada com sucesso");
      setLattesUrl("");
    } catch (err) {
      setError(
        "NÃ£o foi possÃ­vel salvar a URL do Lattes. Tente novamente."
      );
    } finally {
      setUploading(false);
    }
  }

  function handleDeleteLattesUrl() {
    // Implementar DELETE se necessário
  }

  const busy = uploading;

  if (!possuiCurriculo && !lattesUrl) {
    return (
      <EmptyState
        icon={() => <>{/* Ícone placeholder */}</>}
        title="Nenhum currículo enviado ainda."
        action={() => {}}
      />
    );
  }

  return (
    <SurfaceCard>
      <Stack direction="column" spacing={2}>
        {lattesUrl ? (
          <Stack direction="row" spacing={1.5}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              URL do Lattes
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {lattesUrl.length > 50
                ? `${lattesUrl.substring(0, 50)}...`
                : lattesUrl}
            </Typography>
          </Stack>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setLattesUrl("")}
            disabled={busy}
            sx={{ mr: 1 }}
          >
            Remover
          </Button>
        ) : (
          <Stack direction="row" spacing={1.5}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              URL do Lattes
            </Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              Adicionar
            </Button>
          </Stack>
        )}

        {error && (
          <Alert severity="error">{error}</Alert>
        )}

        {!busy && (
          <input
            ref={inputRef}
            type="text"
            value={lattesUrl ?? ""}
            onChange={handleLattesUrlChange}
            placeholder="https://lattes.cnpq.br/..."
            disabled={busy}
            sx={{
              mt: 1,
              width: "100%",
              p: 1,
              borderRadius: 4,
              border: 1,
            }}
            aria-label="URL do Lattes"
          />
        )}

        {busy && (
          <Typography variant="caption" color="text.secondary">
            Salvando...
          </Typography>
        )}
      </Stack>
    </SurfaceCard>
  );
}