"use client";

import { useState, type FormEvent } from "react";
import {
  Dialog,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getApiErrorMessage } from "@/lib/api";
import { updateDadosBasicos } from "@/lib/student";
import type { DadosBasicosResponse } from "@/types/student";
import { FormDialog } from "./FormDialog";
import { SectionCard } from "./SectionCard";
import type { SectionProps } from "./sectionProps";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

export function DadosBasicosSection({ profile, onChanged, notify }: SectionProps) {
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
      <DadosBasicosDialog
        open={open}
        onClose={() => setOpen(false)}
        dados={dados}
        onSaved={() => {
          setOpen(false);
          onChanged();
          notify("Dados básicos atualizados.");
        }}
      />
    </SectionCard>
  );
}

interface DadosBasicosDialogProps {
  open: boolean;
  onClose: () => void;
  dados: DadosBasicosResponse;
  onSaved: () => void;
}

// The dialog stays mounted for the open/close transition; the form only mounts
// while open, so its state always starts from the current profile values.
function DadosBasicosDialog({ open, onClose, dados, onSaved }: DadosBasicosDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <DadosBasicosForm dados={dados} onClose={onClose} onSaved={onSaved} />
      )}
    </Dialog>
  );
}

interface DadosBasicosFormProps {
  dados: DadosBasicosResponse;
  onClose: () => void;
  onSaved: () => void;
}

function DadosBasicosForm({ dados, onClose, onSaved }: DadosBasicosFormProps) {
  const [nome, setNome] = useState(dados.nomeCompleto);
  const [cidade, setCidade] = useState(dados.cidade ?? "");
  const [uf, setUf] = useState(dados.uf ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    const trimmedNome = nome.trim();
    if (trimmedNome.length < 3 || trimmedNome.length > 150) {
      return "O nome completo deve ter entre 3 e 150 caracteres.";
    }
    const trimmedCidade = cidade.trim();
    if (trimmedCidade.length < 2 || trimmedCidade.length > 120) {
      return "A cidade deve ter entre 2 e 120 caracteres.";
    }
    if (!uf) {
      return "Selecione a UF.";
    }
    return null;
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
        nomeCompleto: nome.trim(),
        cidade: cidade.trim(),
        uf,
      });
      onSaved();
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Não foi possível salvar os dados básicos. Tente novamente."
        )
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
          onChange={(e) => setNome(e.target.value)}
          required
          fullWidth
          disabled={saving}
        />
        <TextField
          id="dados-cidade"
          label="Cidade"
          value={cidade}
          onChange={(e) => setCidade(e.target.value)}
          required
          fullWidth
          disabled={saving}
        />
        <TextField
          id="dados-uf"
          select
          label="UF"
          value={uf}
          onChange={(e) => setUf(e.target.value)}
          required
          fullWidth
          disabled={saving}
          slotProps={{ htmlInput: { "aria-label": "UF" } }}
        >
          {UFS.map((opcao) => (
            <MenuItem key={opcao} value={opcao}>
              {opcao}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
    </FormDialog>
  );
}
