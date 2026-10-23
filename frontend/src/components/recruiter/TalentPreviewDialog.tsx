"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Stack, Typography,
} from "@mui/material";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import CloseOutlined from "@mui/icons-material/CloseOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import { CompetencyGroups } from "@/components/common/CompetencyGroups";
import { brandWash } from "@/components/common/surfaceGradient";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { fetchTalent } from "@/lib/recruiter";
import { DISPONIBILIDADE_LABELS, MODALIDADE_LABELS, TIPO_FORMACAO_LABELS } from "@/lib/labels";
import type { TalentProfile } from "@/types/recruiter";
import { FavoriteButton } from "./FavoriteButton";
import { ProtectedTalentPhoto } from "./ProtectedTalentPhoto";
import { RpvShine, RpvVerifiedBadge, rpvHighlightSx } from "./RpvHighlight";

interface TalentPreviewDialogProps {
  open: boolean;
  slug: string | null;
  onClose: () => void;
  onFavoriteChange: (favorite: boolean) => void;
  onUnavailable: () => void;
}

export function TalentPreviewDialog({ open, slug, onClose, onFavoriteChange, onUnavailable }: TalentPreviewDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" aria-labelledby="talent-preview-title"
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
  const onUnavailableRef = useRef(onUnavailable);

  // Keep the latest callback available to the fetch without re-running it.
  useEffect(() => { onUnavailableRef.current = onUnavailable; });

  useEffect(() => {
    let active = true;
    fetchTalent(slug)
      .then((data) => { if (active) setProfile(data); })
      .catch((reason) => {
        if (!active) return;
        if (reason instanceof ApiError && reason.status === 404) {
          setNotFound(true);
          onUnavailableRef.current();
        } else {
          setError(getApiErrorMessage(reason, "Não foi possível carregar a prévia do perfil."));
        }
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

  const rpvVerified = profile.formacoes.some((item) => item.rpvVerificado);

  return (
    <Stack spacing={2.5}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5} useFlexGap sx={(theme) => ({ alignItems: { xs: "center", sm: "flex-start" }, p: 2.5, borderRadius: "4px", position: "relative", backgroundImage: brandWash(theme), ...(rpvVerified && rpvHighlightSx(theme)) })}>
        {rpvVerified && <RpvShine />}
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
      {profile.bio && <Box><Typography variant="subtitle2" color="text.secondary" gutterBottom>Sobre</Typography>
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{profile.bio}</Typography></Box>}
      {mainFormation && <Box><Typography variant="subtitle2" color="text.secondary" gutterBottom>{mainFormation.principal ? "Formação principal" : "Formação"}</Typography>
        <Stack spacing={.75}>
          <Typography variant="body2"><strong>{TIPO_FORMACAO_LABELS[mainFormation.tipo]}:</strong> {mainFormation.nome} · {mainFormation.instituicao}</Typography>
          {rpvVerified && <RpvVerifiedBadge />}
        </Stack></Box>}
      <Box><Typography variant="subtitle2" color="text.secondary" gutterBottom>Competências</Typography>
        {profile.competencias.length ? <CompetencyGroups competencias={profile.competencias} variant="outlined" limit={8} />
          : <Typography variant="body2" color="text.secondary">Nenhuma competência informada.</Typography>}</Box>
      <Box><Typography variant="subtitle2" color="text.secondary" gutterBottom>Disponibilidade e modalidades</Typography>
        {profile.disponibilidades.length || profile.modalidades.length ? <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>
          {profile.disponibilidades.map((item) => <Chip key={item} label={DISPONIBILIDADE_LABELS[item]} size="small" color="primary" variant="outlined" />)}
          {profile.modalidades.map((item) => <Chip key={item} label={MODALIDADE_LABELS[item]} size="small" />)}
        </Stack> : <Typography variant="body2" color="text.secondary">Não informado.</Typography>}</Box>
      <Button component={Link} href={`/recrutador/talentos/${profile.slug}`} variant="contained" endIcon={<ArrowForwardOutlined />} onClick={onClose} fullWidth>Ver perfil completo</Button>
    </Stack>
  );
}
