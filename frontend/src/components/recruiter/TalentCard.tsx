"use client";

import { Button, Card, Checkbox, Chip, Divider, FormControlLabel, Stack, Typography } from "@mui/material";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import PlaceOutlined from "@mui/icons-material/PlaceOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import { CompetencyGroups } from "@/components/common/CompetencyGroups";
import { DISPONIBILIDADE_LABELS, MODALIDADE_LABELS, TIPO_FORMACAO_LABELS } from "@/lib/labels";
import type { TalentListItem } from "@/types/recruiter";
import { ProtectedTalentPhoto } from "./ProtectedTalentPhoto";
import { FavoriteButton } from "./FavoriteButton";
import { RpvShine, RpvVerifiedBadge, rpvHighlightSx } from "./RpvHighlight";

export function TalentCard({ talent, onFavoriteChange, onUnavailable, comparisonSelected, onComparisonChange, onPreview }: { talent: TalentListItem; onFavoriteChange?: (favorite: boolean) => void; onUnavailable?: () => void; comparisonSelected?: boolean; onComparisonChange?: (selected: boolean) => void; onPreview?: () => void }) {
  const rpvVerified = Boolean(talent.formacaoPrincipal?.rpvVerificado);

  return (
    <Card
      component="article"
      sx={(theme) => {
        const { primary } = (theme.vars ?? theme).palette;
        return {
          p: { xs: 2, sm: 2.5 },
          ...(rpvVerified && rpvHighlightSx(theme, comparisonSelected ? 2 : 1)),
          ...(comparisonSelected && !rpvVerified && { borderColor: primary.main, boxShadow: `0 0 0 1px ${primary.main}` }),
        };
      }}
    >
      {rpvVerified && <RpvShine />}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2.5}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", flex: 1, minWidth: 0 }}>
          <ProtectedTalentPhoto path={talent.fotoUrl} name={talent.nomeCompleto} />
          <Stack spacing={1.25} sx={{ minWidth: 0, flex: 1 }}>
            <div>
              <Typography component="h2" variant="h6" sx={{ overflowWrap: "anywhere" }}>{talent.nomeCompleto}</Typography>
              <Stack direction="row" spacing={.5} sx={{ alignItems: "center", mt: .25 }}>
                <PlaceOutlined fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">{[talent.cidade, talent.uf].filter(Boolean).join(" / ") || "Localização não informada"}</Typography>
              </Stack>
            </div>
            {talent.bio && <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{talent.bio}</Typography>}
            {talent.formacaoPrincipal && <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
              <SchoolOutlined fontSize="small" color="action" />
              <Typography variant="body2"><strong>{TIPO_FORMACAO_LABELS[talent.formacaoPrincipal.tipo]}:</strong> {talent.formacaoPrincipal.nome} · {talent.formacaoPrincipal.instituicao}</Typography>
              {rpvVerified && <RpvVerifiedBadge />}
            </Stack>}
            <CompetencyGroups competencias={talent.competencias} variant="outlined" limit={6} />
            <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>
              {talent.disponibilidades.map((item) => <Chip key={item} label={DISPONIBILIDADE_LABELS[item]} size="small" color="primary" variant="outlined" />)}
              {talent.modalidades.map((item) => <Chip key={item} label={MODALIDADE_LABELS[item]} size="small" />)}
            </Stack>
          </Stack>
        </Stack>
        <Divider flexItem orientation="vertical" sx={{ display: { xs: "none", sm: "block" } }} />
        <Stack spacing={.75} sx={{ alignSelf: { xs: "stretch", sm: "center" }, flexShrink: 0 }}>
          {onFavoriteChange && <FavoriteButton slug={talent.slug} name={talent.nomeCompleto} favorite={talent.favorito} onChange={onFavoriteChange} onUnavailable={onUnavailable} />}
          {onComparisonChange !== undefined && <FormControlLabel control={<Checkbox checked={Boolean(comparisonSelected)} onChange={(event) => onComparisonChange(event.target.checked)} />} label="Comparar" />}
          <Button variant="contained" size="small" onClick={onPreview} endIcon={<ArrowForwardOutlined />} aria-label={`Abrir prévia de ${talent.nomeCompleto}`}>Ver prévia</Button>
        </Stack>
      </Stack>
    </Card>
  );
}
