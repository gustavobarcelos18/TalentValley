"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography,
} from "@mui/material";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import VerifiedOutlined from "@mui/icons-material/VerifiedOutlined";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { fetchTalent } from "@/lib/recruiter";
import { DISPONIBILIDADE_LABELS, MODALIDADE_LABELS, TIPO_FORMACAO_LABELS } from "@/lib/labels";
import type { TalentProfile } from "@/types/recruiter";
import { FavoriteButton } from "./FavoriteButton";
import { ProtectedTalentPhoto } from "./ProtectedTalentPhoto";

interface TalentPreviewDialogProps {
  open: boolean;
  slug: string | null;
  onClose: () => void;
  onFavoriteChange: (favorite: boolean) => void;
  onUnavailable: () => void;
}

export function TalentPreviewDialog({ open, slug, onClose, onFavoriteChange, onUnavailable }: TalentPreviewDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="talent-preview-title"
      slotProps={{ paper: { sx: { m: { xs: 1, sm: 3 }, maxHeight: { xs: "calc(100% - 16px)", sm: "calc(100% - 64px)" } } } }}>
      <DialogTitle>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography id="talent-preview-title" component="span" variant="h6">Prévia do perfil</Typography>
          <IconButton aria-label="Fechar prévia" onClick={onClose}><CloseOutlined /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {open && slug ? <TalentPreviewContent key={slug} slug={slug} onClose={onClose} onFavoriteChange={onFavoriteChange} onUnavailable={onUnavailable} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TalentPreviewContent({ slug, onClose, onFavoriteChange, onUnavailable }: { slug: string; onClose: () => void; onFavoriteChange: (favorite: boolean) => void; onUnavailable: () => void }) {
  const [profile, setProfile] = useState<TalentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    fetchTalent(slug)
      .then((data) => { if (active) setProfile(data); })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 404) setNotFound(true);
        else setError(getApiErrorMessage(reason, "Não foi possível carregar a prévia do perfil."));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [slug, version]);

  function retry() { setLoading(true); setError(null); setNotFound(false); setProfile(null); setVersion((value) => value + 1); }
  function handleUnavailable() { setNotFound(true); onUnavailable(); }

  if (loading) {
    return (
      <Stack spacing={2} sx={{ alignItems: "center", py: 4 }}>
        <CircularProgress />
        <Typography color="text.secondary">Carregando perfil…</Typography>
      </Stack>
    );
  }
  if (notFound) {
    return (
      <Stack spacing={1.5} sx={{ alignItems: "center", py: 3, textAlign: "center" }}>
        <Typography>Este perfil não está mais disponível.</Typography>
        <Button variant="outlined" onClick={onClose}>Fechar</Button>
      </Stack>
    );
  }
  if (error || !profile) {
    return (
      <Alert severity="error" action={<Button color="inherit" onClick={retry}>Tentar novamente</Button>}>{error ?? "Não foi possível carregar a prévia do perfil."}</Alert>
    );
  }

  const mainFormation = profile.formacoes.find((item) => item.principal) ?? profile.formacoes[0] ?? null;

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} sx={{ alignItems: { xs: "center", sm: "flex-start" } }}>
        <ProtectedTalentPhoto path={profile.fotoUrl} name={profile.nomeCompleto} size={96} />
        <Stack spacing={1} sx={{ minWidth: 0, flex: 1, alignItems: { xs: "center", sm: "flex-start" }, textAlign: { xs: "center", sm: "left" } }}>
          <Typography component="h2" variant="h5">{profile.nomeCompleto}</Typography>
          <Stack direction="row" spacing={.5} sx={{ alignItems: "center" }}>
            <PlaceOutlined fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">{[profile.cidade, profile.uf].filter(Boolean).join(" / ") || "Localização não informada"}</Typography>
          </Stack>
          <FavoriteButton slug={profile.slug} name={profile.nomeCompleto} favorite={profile.favorito}
            onChange={(favorite) => { setProfile((current) => current ? { ...current, favorito: favorite } : current); onFavoriteChange(favorite); }}
            onUnavailable={handleUnavailable} />
        </Stack>
      </Stack>
      {profile.bio && <Box><Typography variant="subtitle2" gutterBottom>Sobre</Typography>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{profile.bio}</Typography></Box>}
      {mainFormation && <Box><Typography variant="subtitle2" gutterBottom>Formação principal</Typography>
        <Stack spacing={.75}>
          <Typography variant="body2"><strong>{TIPO_FORMACAO_LABELS[mainFormation.tipo]}:</strong> {mainFormation.nome} · {mainFormation.instituicao}</Typography>
          {mainFormation.rpvVerificado && <Chip icon={<VerifiedOutlined />} size="small" color="success" label="Verificado pelo Rio Pomba Valley" sx={{ alignSelf: "flex-start" }} />}
        </Stack></Box>}
      <Box><Typography variant="subtitle2" gutterBottom>Competências</Typography>
        {profile.competencias.length ? <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>{profile.competencias.slice(0, 8).map((item) => <Chip key={item.id} label={item.nome} size="small" variant="outlined" />)}</Stack>
          : <Typography variant="body2" color="text.secondary">Nenhuma competência informada.</Typography>}</Box>
      <Box><Typography variant="subtitle2" gutterBottom>Disponibilidade e modalidades</Typography>
        {profile.disponibilidades.length || profile.modalidades.length ? <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          {profile.disponibilidades.map((item) => <Chip key={item} label={DISPONIBILIDADE_LABELS[item]} size="small" color="primary" variant="outlined" />)}
          {profile.modalidades.map((item) => <Chip key={item} label={MODALIDADE_LABELS[item]} size="small" />)}
        </Stack> : <Typography variant="body2" color="text.secondary">Não informado.</Typography>}</Box>
      <Button component={Link} href={`/recrutador/talentos/${profile.slug}`} variant="contained" endIcon={<ArrowForwardOutlined />} onClick={onClose} fullWidth>Ver perfil completo</Button>
    </Stack>
  );
}
