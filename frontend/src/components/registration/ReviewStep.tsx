"use client";

import type { ReactNode } from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import { ConsentField } from "./ConsentField";
import type { CommonForm, FocusableControl } from "./registrationForm";

const EMPTY = "Não informado";

function SummaryCard({
  title,
  editLabel,
  onEdit,
  disabled,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <Paper variant="outlined" component="section" sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 1 }}>
        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Button type="button" size="small" onClick={onEdit} disabled={disabled} aria-label={editLabel}>
          Editar
        </Button>
      </Box>
      <Box component="dl" sx={{ m: 0, display: "grid", gap: 1 }}>
        {children}
      </Box>
    </Paper>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: "anywhere" }}>
        {value || EMPTY}
      </Typography>
    </Box>
  );
}

// Second summary card of the review: the profile-specific data (education for
// students, company for recruiters), always reached through step 1.
export interface ReviewDetails {
  title: string;
  editLabel: string;
  rows: { label: string; value: string }[];
}

interface ReviewStepProps {
  personal: CommonForm;
  details: ReviewDetails;
  consent: boolean;
  consentError: string | null | undefined;
  disabled: boolean;
  onConsentChange: (checked: boolean) => void;
  onEditStep: (step: number) => void;
  registerFieldRef: (key: string) => (node: FocusableControl) => void;
}

// Step "Revisão e termos" of the signup wizards: read-only summary with a way
// back to each step, plus the terms consent that gates the submission.
export function ReviewStep({
  personal,
  details,
  consent,
  consentError,
  disabled,
  onConsentChange,
  onEditStep,
  registerFieldRef,
}: ReviewStepProps) {
  return (
    <>
      <SummaryCard
        title="Dados pessoais"
        editLabel="Editar dados pessoais"
        onEdit={() => onEditStep(0)}
        disabled={disabled}
      >
        <SummaryRow label="Nome completo" value={personal.nomeCompleto} />
        <SummaryRow label="E-mail" value={personal.email} />
        <SummaryRow label="Telefone" value={personal.telefone} />
        <SummaryRow label="CEP" value={personal.cep} />
        <SummaryRow label="Cidade e estado" value={`${personal.cidade} - ${personal.uf}`} />
      </SummaryCard>

      <SummaryCard
        title={details.title}
        editLabel={details.editLabel}
        onEdit={() => onEditStep(1)}
        disabled={disabled}
      >
        {details.rows.map((row) => (
          <SummaryRow key={row.label} label={row.label} value={row.value} />
        ))}
      </SummaryCard>

      <ConsentField
        checked={consent}
        error={consentError}
        disabled={disabled}
        onChange={onConsentChange}
        inputRef={registerFieldRef("consentTermos")}
      />
    </>
  );
}
