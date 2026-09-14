"use client";

import { useState, type FormEvent } from "react";
import { Autocomplete, Checkbox, Chip, Dialog, Stack, TextField, Typography } from "@mui/material";
import { getApiErrorMessage } from "@/lib/api";
import {
  DISPONIBILIDADE_LABELS,
  DISPONIBILIDADE_OPCOES,
  MODALIDADE_LABELS,
  MODALIDADE_OPCOES,
} from "@/lib/labels";
import { updateDisponibilidade } from "@/lib/student";
import type {
  ModalidadeTrabalho,
  TipoDisponibilidade,
} from "@/types/student";
import { FormDialog } from "./FormDialog";
import { SectionCard } from "./SectionCard";
import type { SectionProps } from "./sectionProps";

export function DisponibilidadeSection({ profile, onChanged, notify }: SectionProps) {
  const [open, setOpen] = useState(false);
  const { disponibilidades, modalidades } = profile;
  const isEmpty = disponibilidades.length === 0 && modalidades.length === 0;

  return (
    <SectionCard
      title="Disponibilidade e modalidade"
      editLabel="Editar disponibilidade e modalidade"
      onEdit={() => setOpen(true)}
      isEmpty={isEmpty}
      emptyMessage="Informe os tipos de vaga que você busca e como prefere trabalhar."
      emptyActionLabel="Informar disponibilidade"
    >
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Typography variant="subtitle2" color="text.secondary">
            Disponibilidade
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {disponibilidades.map((item) => (
              <Chip
                key={item}
                label={DISPONIBILIDADE_LABELS[item]}
                color="primary"
                variant="outlined"
                size="small"
              />
            ))}
          </Stack>
        </Stack>
        <Stack spacing={1}>
          <Typography variant="subtitle2" color="text.secondary">
            Modalidade de trabalho
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {modalidades.map((item) => (
              <Chip
                key={item}
                label={MODALIDADE_LABELS[item]}
                variant="outlined"
                size="small"
              />
            ))}
          </Stack>
        </Stack>
      </Stack>
      <DisponibilidadeDialog
        open={open}
        onClose={() => setOpen(false)}
        disponibilidades={disponibilidades}
        modalidades={modalidades}
        onSaved={() => {
          setOpen(false);
          onChanged();
          notify("Disponibilidade atualizada.");
        }}
      />
    </SectionCard>
  );
}
interface DisponibilidadeDialogProps {
  open: boolean;
  onClose: () => void;
  disponibilidades: TipoDisponibilidade[];
  modalidades: ModalidadeTrabalho[];
  onSaved: () => void;
}

// The dialog stays mounted for the open/close transition; the form only mounts
// while open, so its state always starts from the current profile values.
function DisponibilidadeDialog({ open, onClose, disponibilidades, modalidades, onSaved }: DisponibilidadeDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <DisponibilidadeForm
          disponibilidades={disponibilidades}
          modalidades={modalidades}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

interface DisponibilidadeFormProps {
  disponibilidades: TipoDisponibilidade[];
  modalidades: ModalidadeTrabalho[];
  onClose: () => void;
  onSaved: () => void;
}

function DisponibilidadeForm({ disponibilidades, modalidades, onClose, onSaved }: DisponibilidadeFormProps) {
  const [dispSelecionadas, setDispSelecionadas] = useState<TipoDisponibilidade[]>(disponibilidades);
  const [modSelecionadas, setModSelecionadas] = useState<ModalidadeTrabalho[]>(modalidades);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Backend enum values unchanged; labels are only for display here.
      await updateDisponibilidade({
        disponibilidades: dispSelecionadas,
        modalidades: modSelecionadas,
      });
      onSaved();
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Não foi possível salvar a disponibilidade. Tente novamente."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      title="Editar disponibilidade e modalidade"
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
      error={error}
    >
      <Stack spacing={3}>
        <Autocomplete
          multiple
          disableCloseOnSelect
          options={DISPONIBILIDADE_OPCOES}
          value={dispSelecionadas}
          onChange={(_, value) => setDispSelecionadas(value)}
          getOptionLabel={(option) => DISPONIBILIDADE_LABELS[option]}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Disponibilidade"
              placeholder="Tipos de vaga"
            />
          )}
          renderOption={(props, option) => {
            const { key, ...rest } = props;
            return (
              <li key={key} {...rest}>
                <Checkbox
                  checked={dispSelecionadas.includes(option)}
                  size="small"
                  sx={{ mr: 1 }}
                />
                {DISPONIBILIDADE_LABELS[option]}
              </li>
            );
          }}
        />
        <Autocomplete
          multiple
          disableCloseOnSelect
          options={MODALIDADE_OPCOES}
          value={modSelecionadas}
          onChange={(_, value) => setModSelecionadas(value)}
          getOptionLabel={(option) => MODALIDADE_LABELS[option]}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Modalidade de trabalho"
              placeholder="Presencial, híbrido ou remoto"
            />
          )}
          renderOption={(props, option) => {
            const { key, ...rest } = props;
            return (
              <li key={key} {...rest}>
                <Checkbox
                  checked={modSelecionadas.includes(option)}
                  size="small"
                  sx={{ mr: 1 }}
                />
                {MODALIDADE_LABELS[option]}
              </li>
            );
          }}
        />
      </Stack>
    </FormDialog>
      );
}
