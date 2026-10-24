"use client";

import { useState, type ReactNode } from "react";
import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import TravelExploreOutlined from "@mui/icons-material/TravelExploreOutlined";
import { getApiErrorMessage } from "@/lib/api";
import {
  avisoStatusBusca,
  buscaEstaVazia,
  disponivelAgora,
  resumoHabilitacao,
  resumoMobilidade,
  resumoPcd,
} from "@/lib/busca";
import { formatDate } from "@/lib/format";
import {
  AREA_INTERESSE_LABELS,
  CARGA_HORARIA_LABELS,
  DISPONIBILIDADE_LABELS,
  MODALIDADE_LABELS,
  STATUS_BUSCA_LABELS,
} from "@/lib/labels";
import { confirmBusca } from "@/lib/student";
import type { BuscaResponse, StatusBusca } from "@/types/student";
import { BuscaForm } from "./BuscaForm";
import { SectionCard } from "./SectionCard";
import type { SectionProps } from "./sectionProps";

function Row({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <Stack spacing={0.75}>
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

function Chips({ labels, color }: Readonly<{ labels: string[]; color?: "primary" }>) {
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
      {labels.map((label) => (
        <Chip key={label} label={label} color={color} variant="outlined" size="small" />
      ))}
    </Stack>
  );
}

// A row with chips that is left out when there is nothing to show.
function ChipsRow({ label, labels, color }: Readonly<{ label: string; labels: string[]; color?: "primary" }>) {
  if (labels.length === 0) return null;
  return (
    <Row label={label}>
      <Chips labels={labels} color={color} />
    </Row>
  );
}

function TextRow({ label, text }: Readonly<{ label: string; text: string | null }>) {
  if (!text) return null;
  return (
    <Row label={label}>
      <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>
        {text}
      </Typography>
    </Row>
  );
}

interface StatusBlockProps {
  status: StatusBusca;
  aviso: string | null;
  onChanged: () => void;
  notify: (message: string) => void;
}

// Search status with its warnings and the reconfirmation action.
function StatusBlock({ status, aviso, onChanged, notify }: Readonly<StatusBlockProps>) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setConfirming(true);
    try {
      await confirmBusca();
      onChanged();
      notify("Situação de busca confirmada.");
    } catch (err) {
      setError(getApiErrorMessage(err, "Não foi possível confirmar agora. Tente novamente."));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
        <Chip label={STATUS_BUSCA_LABELS[status]} color="primary" size="small" />
        <Button size="small" onClick={() => void handleConfirm()} disabled={confirming}>
          {confirming ? "Confirmando..." : "Confirmar que continuo assim"}
        </Button>
      </Stack>
      {status === "NAO_BUSCANDO" && (
        <Alert severity="info" role="status">
          Você marcou que não está buscando agora. Seu perfil continua aparecendo para recrutadores, com este aviso.
        </Alert>
      )}
      {aviso && (
        <Alert severity="warning" role="status">
          {aviso}
        </Alert>
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </Stack>
  );
}

function inicioTexto(busca: BuscaResponse): string | null {
  if (disponivelAgora(busca)) return "Imediato";
  return busca.disponivelAPartirDe ? formatDate(busca.disponivelAPartirDe) : null;
}

// "O que eu busco": status, goal, areas, job types, work modes, start date, hours, mobility,
// driver's license and the optional PCD block. Editing happens in one dialog (BuscaForm).
export function DisponibilidadeSection({ profile, onChanged, notify }: Readonly<SectionProps>) {
  const [open, setOpen] = useState(false);
  const { busca, disponibilidades, modalidades } = profile;

  return (
    <SectionCard
      title="O que eu busco"
      editLabel="Editar o que eu busco"
      onEdit={() => setOpen(true)}
      isEmpty={buscaEstaVazia(busca, disponibilidades, modalidades)}
      emptyMessage="Conte o que você busca: situação, objetivo, áreas, tipos de vaga e como prefere trabalhar."
      emptyActionLabel="Informar o que eu busco"
      emptyIcon={<TravelExploreOutlined />}
    >
      <Stack spacing={2}>
        {busca.status !== null && (
          <StatusBlock status={busca.status} aviso={avisoStatusBusca(busca)} onChanged={onChanged} notify={notify} />
        )}
        <TextRow label="Objetivo profissional" text={busca.objetivo} />
        <ChipsRow label="Áreas de interesse" labels={busca.areasInteresse.map((area) => AREA_INTERESSE_LABELS[area])} />
        <ChipsRow
          label="Tipos de vaga"
          labels={disponibilidades.map((item) => DISPONIBILIDADE_LABELS[item])}
          color="primary"
        />
        <ChipsRow label="Modalidade de trabalho" labels={modalidades.map((item) => MODALIDADE_LABELS[item])} />
        <TextRow label="Disponível a partir de" text={inicioTexto(busca)} />
        <TextRow label="Carga horária semanal" text={busca.cargaHoraria ? CARGA_HORARIA_LABELS[busca.cargaHoraria] : null} />
        <ChipsRow label="Mobilidade" labels={resumoMobilidade(busca)} />
        <ChipsRow label="Habilitação" labels={resumoHabilitacao(busca)} />
        <ChipsRow label="Pessoa com deficiência (PCD)" labels={resumoPcd(busca)} />
      </Stack>
      {open && (
        <BuscaForm
          profile={profile}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onChanged();
            notify("O que você busca foi atualizado.");
          }}
        />
      )}
    </SectionCard>
  );
}
