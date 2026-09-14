"use client";

import { useState } from "react";
import { Button, CircularProgress, Typography } from "@mui/material";
import FavoriteBorderOutlined from "@mui/icons-material/FavoriteBorderOutlined";
import FavoriteOutlined from "@mui/icons-material/FavoriteOutlined";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { addFavorite, removeFavorite } from "@/lib/recruiter";

interface FavoriteButtonProps {
  slug: string;
  name: string;
  favorite: boolean;
  onChange: (favorite: boolean) => void;
  onUnavailable?: () => void;
}

export function FavoriteButton({ slug, name, favorite, onChange, onUnavailable }: FavoriteButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setLoading(true); setError(null);
    try {
      if (favorite) await removeFavorite(slug); else await addFavorite(slug);
      onChange(!favorite);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 404) {
        if (onUnavailable) onUnavailable();
        else setError("Este perfil não está mais disponível.");
      } else setError(getApiErrorMessage(reason, "Não foi possível atualizar os favoritos."));
    } finally { setLoading(false); }
  }

  const action = favorite ? "Remover dos favoritos" : "Adicionar aos favoritos";
  return <>
    <Button variant={favorite ? "outlined" : "text"} color={favorite ? "error" : "primary"} size="small"
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); void toggle(); }} disabled={loading}
      aria-label={`${action}: ${name}`} aria-busy={loading}
      startIcon={loading ? <CircularProgress size={16} /> : favorite ? <FavoriteOutlined /> : <FavoriteBorderOutlined />}>
      {loading ? "Atualizando…" : action}
    </Button>
    {error && <Typography role="alert" variant="caption" color="error">{error}</Typography>}
  </>;
}
