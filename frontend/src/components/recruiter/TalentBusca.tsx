"use client";

import { Box, Chip, Stack, Typography } from "@mui/material";
import { disponivelAgora, resumoMobilidade } from "@/lib/busca";
import { formatDate } from "@/lib/format";
import { AREA_INTERESSE_LABELS, CARGA_HORARIA_LABELS, DISPONIBILIDADE_LABELS, MODALIDADE_LABELS } from "@/lib/labels";
import { AVISO_PCD, INFORMADO_PELO_ALUNO, STATUS_BUSCA_RECRUTADOR_LABELS, avisoStatusDesatualizado, etiquetasPcd, habilitacaoBusca, linhaBusca } from "@/lib/talent-busca";
import type { TalentBusca } from "@/types/recruiter";
import type { ModalidadeTrabalho, StatusBusca, TipoDisponibilidade } from "@/types/student";

const STATUS_COLORS: Record<StatusBusca, "success" | "primary" | "warning"> = {
  BUSCANDO_ATIVAMENTE: "success",
  ABERTO_A_PROPOSTAS: "primary",
  NAO_BUSCANDO: "warning",
};

/** Status chip (the student stays visible even when not looking) plus the outdated-status warning. */
export function BuscaStatus({ busca }: { busca: TalentBusca }) {
  const aviso = avisoStatusDesatualizado(busca);
  if (!busca.status && !aviso) return null;
  return (
    <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>
      {busca.status && <Chip label={STATUS_BUSCA_RECRUTADOR_LABELS[busca.status]} size="small" color={STATUS_COLORS[busca.status]} variant={busca.status === "NAO_BUSCANDO" ? "outlined" : "filled"} />}
      {aviso && <Chip label={aviso} size="small" color="warning" variant="outlined" />}
    </Stack>
  );
}

/** Compact version for the result card. */
export function BuscaCardSummary({ busca, disponibilidades, modalidades }: { busca: TalentBusca; disponibilidades: readonly TipoDisponibilidade[]; modalidades: readonly ModalidadeTrabalho[] }) {
  const linha = linhaBusca(disponibilidades, modalidades, busca);
  const habilitacao = habilitacaoBusca(busca);
  const pcd = etiquetasPcd(busca.pcd);
  return (
    <Stack spacing={.75}>
      <BuscaStatus busca={busca} />
      {linha && <Typography variant="body2"><strong>Busca:</strong> {linha}</Typography>}
      {habilitacao.length > 0 && <Typography variant="body2"><strong>Habilitação:</strong> {habilitacao.join(" · ")} <Typography component="span" variant="caption" color="text.secondary">({INFORMADO_PELO_ALUNO})</Typography></Typography>}
      {pcd.length > 0 && <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>
        {pcd.map((item) => <Chip key={item} label={item} size="small" variant="outlined" />)}
      </Stack>}
    </Stack>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <Box><Typography variant="subtitle2" color="text.secondary" gutterBottom>{label}</Typography>{children}</Box>;
}

function ChipRow({ values, primary }: { values: string[]; primary?: boolean }) {
  return <Stack direction="row" spacing={.75} useFlexGap sx={{ flexWrap: "wrap" }}>
    {values.map((item) => <Chip key={item} label={item} size="small" color={primary ? "primary" : "default"} variant={primary ? "outlined" : "filled"} />)}
  </Stack>;
}

function inicioDetalhe(busca: TalentBusca): string | null {
  if (disponivelAgora(busca)) return "Imediato";
  return busca.disponivelAPartirDe ? `A partir de ${formatDate(busca.disponivelAPartirDe)}` : null;
}

/** Full version for the profile, preview, comparison and admin screens. Shows only what was informed. */
export function BuscaDetails({ busca, disponibilidades, modalidades }: { busca: TalentBusca; disponibilidades: readonly TipoDisponibilidade[]; modalidades: readonly ModalidadeTrabalho[] }) {
  const inicio = inicioDetalhe(busca);
  const mobilidade = resumoMobilidade(busca);
  const habilitacao = habilitacaoBusca(busca);
  const pcd = etiquetasPcd(busca.pcd);
  const rows = [
    (busca.status || busca.statusDesatualizado) && <Row key="situacao" label="Situação"><BuscaStatus busca={busca} /></Row>,
    busca.objetivo && <Row key="objetivo" label="Objetivo"><Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>{busca.objetivo}</Typography></Row>,
    busca.areasInteresse.length > 0 && <Row key="areas" label="Áreas de interesse"><ChipRow values={busca.areasInteresse.map((item) => AREA_INTERESSE_LABELS[item])} /></Row>,
    disponibilidades.length > 0 && <Row key="vagas" label="Tipos de vaga"><ChipRow primary values={disponibilidades.map((item) => DISPONIBILIDADE_LABELS[item])} /></Row>,
    modalidades.length > 0 && <Row key="modalidades" label="Modalidades"><ChipRow values={modalidades.map((item) => MODALIDADE_LABELS[item])} /></Row>,
    inicio && <Row key="inicio" label="Disponível a partir de"><Typography variant="body2">{inicio}</Typography></Row>,
    busca.cargaHoraria && <Row key="carga" label="Carga horária"><Typography variant="body2">{CARGA_HORARIA_LABELS[busca.cargaHoraria]}</Typography></Row>,
    mobilidade.length > 0 && <Row key="mobilidade" label="Mobilidade"><Typography variant="body2">{mobilidade.join(" · ")}</Typography></Row>,
    habilitacao.length > 0 && <Row key="habilitacao" label="Habilitação"><Typography variant="body2">{habilitacao.join(" · ")}</Typography><Typography variant="caption" color="text.secondary">Informado pelo aluno.</Typography></Row>,
    pcd.length > 0 && <Row key="pcd" label="Informações PCD"><ChipRow values={pcd} /><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: .75 }}>{AVISO_PCD}</Typography></Row>,
  ].filter(Boolean);
  if (rows.length === 0) return <Typography variant="body2" color="text.secondary">Este talento ainda não informou o que busca.</Typography>;
  return <Stack spacing={1.75}>{rows}</Stack>;
}
