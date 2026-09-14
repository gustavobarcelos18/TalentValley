"use client";

import Link from "next/link";
import { Button, Checkbox, Chip, FormControlLabel, Paper, Stack, Typography } from "@mui/material";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import VerifiedOutlined from "@mui/icons-material/VerifiedOutlined";
import { DISPONIBILIDADE_LABELS, MODALIDADE_LABELS, TIPO_FORMACAO_LABELS } from "@/lib/labels";
import type { TalentListItem } from "@/types/recruiter";
import { ProtectedTalentPhoto } from "./ProtectedTalentPhoto";
import { FavoriteButton } from "./FavoriteButton";

export function TalentCard({ talent, onFavoriteChange, comparisonSelected, onComparisonChange }: { talent: TalentListItem; onFavoriteChange?: (favorite: boolean) => void; comparisonSelected?: boolean; onComparisonChange?: (selected: boolean) => void }) {
  return (
    <Paper component="article" elevation={0} sx={{ p: { xs: 2, sm: 2.5 }, border: 1, borderColor: "divider" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", flex: 1, minWidth: 0 }}>
          <ProtectedTalentPhoto path={talent.fotoUrl} name={talent.nomeCompleto} />
          <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              <Typography component="h2" variant="h6">{talent.nomeCompleto}</Typography>
            </Stack>
            <Stack direction="row" spacing={.5} sx={{ alignItems: "center" }}>
              <PlaceOutlined fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">{[talent.cidade, talent.uf].filter(Boolean).join(" / ") || "Localização não informada"}</Typography>
            </Stack>
            {talent.bio && <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{talent.bio}</Typography>}
            {talent.formacaoPrincipal && <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              <Typography variant="body2"><strong>{TIPO_FORMACAO_LABELS[talent.formacaoPrincipal.tipo]}:</strong> {talent.formacaoPrincipal.nome} · {talent.formacaoPrincipal.instituicao}</Typography>
              {talent.formacaoPrincipal.rpvVerificado && <Chip icon={<VerifiedOutlined />} size="small" color="success" label="Verificado pelo Rio Pomba Valley" />}
            </Stack>}
            <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>
              {talent.competencias.slice(0, 6).map((item) => <Chip key={item.id} label={item.nome} size="small" variant="outlined" />)}
              {talent.competencias.length > 6 && <Chip label={`+${talent.competencias.length - 6}`} size="small" />}
            </Stack>
            <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>
              {talent.disponibilidades.map((item) => <Chip key={item} label={DISPONIBILIDADE_LABELS[item]} size="small" color="primary" variant="outlined" />)}
              {talent.modalidades.map((item) => <Chip key={item} label={MODALIDADE_LABELS[item]} size="small" />)}
            </Stack>
          </Stack>
        </Stack>
        <Stack spacing={.5} sx={{ alignSelf: { xs: "stretch", sm: "center" }, flexShrink: 0 }}>
          {onFavoriteChange && <FavoriteButton slug={talent.slug} name={talent.nomeCompleto} favorite={talent.favorito} onChange={onFavoriteChange} />}
          {onComparisonChange !== undefined && <FormControlLabel control={<Checkbox checked={Boolean(comparisonSelected)} onChange={(event) => onComparisonChange(event.target.checked)} />} label="Comparar" />}
          <Button component={Link} href={`/recrutador/talentos/${talent.slug}`} endIcon={<ArrowForwardOutlined />} aria-label={`Abrir perfil de ${talent.nomeCompleto}`}>Ver perfil</Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
