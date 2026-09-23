"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Autocomplete,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getApiErrorMessage } from "@/lib/api";
import { fetchCompetenciaCatalog, updateCompetencias } from "@/lib/student";
import type { CatalogoCompetenciaResponse } from "@/types/student";
import { FormDialog } from "./FormDialog";
import { SectionCard } from "./SectionCard";
import type { SectionProps } from "./sectionProps";

export function CompetenciasSection({ profile, onChanged, notify }: SectionProps) {
  const [open, setOpen] = useState(false);
  const competencias = profile.competencias;

  return (
    <SectionCard
      title="Competências"
      editLabel="Editar competências"
      onEdit={() => setOpen(true)}
      isEmpty={competencias.length === 0}
      emptyMessage="Selecione as competências que representam suas habilidades."
      emptyActionLabel="Adicionar competências"
    >
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {competencias.map((competencia) => (
          <Chip
            key={competencia.id}
            label={competencia.nome}
            color="primary"
            variant="outlined"
            size="small"
          />
        ))}
      </Stack>
      {open && (
        <CompetenciasForm
          selecionadas={competencias}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onChanged();
            notify("Competências atualizadas.");
          }}
        />
      )}
    </SectionCard>
  );
}
interface CompetenciasFormProps {
  selecionadas: { id: number; nome: string }[];
  onClose: () => void;
  onSaved: () => void;
}

function CompetenciasForm({ selecionadas, onClose, onSaved }: CompetenciasFormProps) {
  const [selecao, setSelecao] = useState(selecionadas);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalogo, setCatalogo] = useState<CatalogoCompetenciaResponse[] | null>(null);
  const [catalogoError, setCatalogoError] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCompetenciaCatalog()
      .then((items) => {
        if (active) setCatalogo(items);
      })
      .catch(() => {
        if (active) setCatalogoError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const opcoes = catalogo ?? [];
  const catalogoLoading = catalogo === null && !catalogoError;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Only controlled catalog IDs are sent; no skill levels in this phase.
      await updateCompetencias({ competenciaIds: selecao.map((item) => item.id) });
      onSaved();
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          "Não foi possível salvar as competências. Tente novamente."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      title="Editar competências"
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
      error={error}
    >
      <Stack spacing={2}>
        {catalogoError && (
          <Alert severity="warning" role="alert">
            Não foi possível carregar o catálogo de competências.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary">
          Selecione quantas competências quiser do catálogo do Rio Pomba Valley.
        </Typography>
        <Autocomplete
          multiple
          disableCloseOnSelect
          options={opcoes}
          value={selecao}
          onChange={(_, value) => setSelecao(value)}
          getOptionLabel={(option) => option.nome}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          loading={catalogoLoading}
          disabled={saving || catalogoLoading}
          renderInput={(params) => (
            <TextField
              {...params}
              slotProps={{
                ...params.slotProps,
                htmlInput: {
                  ...params.slotProps.htmlInput,
                  value: params.slotProps.htmlInput.value ?? "",
                },
              }}
              label="Competências"
              placeholder="Buscar competência"
            />
          )}
        />
      </Stack>
    </FormDialog>
    );
}
