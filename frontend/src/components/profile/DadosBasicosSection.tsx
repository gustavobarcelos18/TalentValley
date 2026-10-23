"use client";

import { useState, type FormEvent } from "react";
import { Stack, TextField, Typography } from "@mui/material";
import { CityStateFields } from "@/components/registration/CityStateFields";
import { getApiErrorMessage } from "@/lib/api";
import {
  normalizeWhitespace,
  sanitizeCityName,
  sanitizePersonName,
  stripEmojiOnPaste,
  validateCityName,
  validatePersonName,
  validateUF,
} from "@/lib/validation";
import { updateDadosBasicos } from "@/lib/student";
import type { DadosBasicosResponse } from "@/types/student";
import { FormDialog } from "./FormDialog";
import { SectionCard } from "./SectionCard";
import type { SectionProps } from "./sectionProps";

export function DadosBasicosSection({
  profile,
  onChanged,
  notify,
}: SectionProps) {
  const [open, setOpen] = useState(false);
  const dados = profile.dadosBasicos;

  return (
    <SectionCard
      title="Dados básicos"
      editLabel="Editar dados básicos"
      onEdit={() => setOpen(true)}
    >
      <Stack spacing={0.5}>
        <Typography variant="body1" sx={{ fontWeight: 600 }}>
          {dados.nomeCompleto}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {[dados.cidade, dados.uf].filter(Boolean).join(" - ") ||
            "Localização não informada"}
        </Typography>
      </Stack>
      {open && (
        <DadosBasicosForm
          dados={dados}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onChanged();
            notify("Dados básicos atualizados.");
          }}
        />
      )}
    </SectionCard>
  );
}

interface DadosBasicosFormProps {
  dados: DadosBasicosResponse;
  onClose: () => void;
  onSaved: () => void;
}

function DadosBasicosForm({ dados, onClose, onSaved }: DadosBasicosFormProps) {
  const [nome, setNome] = useState(() =>
    sanitizePersonName(dados.nomeCompleto),
  );
  // The city list depends on the UF, so a saved city without a UF starts empty.
  const [cidade, setCidade] = useState(() =>
    dados.uf ? sanitizeCityName(dados.cidade ?? "") : "",
  );
  const [uf, setUf] = useState(dados.uf ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    const nameError = validatePersonName(nome);
    if (nameError) return nameError;
    const ufError = validateUF(uf);
    if (ufError) return ufError;
    return validateCityName(cidade);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await updateDadosBasicos({
        nomeCompleto: normalizeWhitespace(nome),
        cidade: normalizeWhitespace(cidade),
        uf,
      });
      onSaved();
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Não foi possível salvar os dados básicos. Tente novamente.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      title="Editar dados básicos"
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
      error={error}
    >
      <Stack spacing={2.5}>
        <TextField
          id="dados-nome"
          label="Nome completo"
          value={nome}
          onChange={(e) => setNome(sanitizePersonName(e.target.value))}
          required
          fullWidth
          disabled={saving}
          slotProps={{
            htmlInput: { maxLength: 150, onPaste: stripEmojiOnPaste },
          }}
          error={Boolean(validatePersonName(nome))}
          helperText={
            validatePersonName(nome) ??
            "Use letras, espaços, hífen e apóstrofo."
          }
        />
        <CityStateFields
          idPrefix="dados"
          cidade={cidade}
          uf={uf}
          onCidadeChange={setCidade}
          onUfChange={setUf}
          disabled={saving}
        />
      </Stack>
    </FormDialog>
  );
}
