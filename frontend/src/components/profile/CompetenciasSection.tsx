"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Autocomplete,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PsychologyOutlined from "@mui/icons-material/PsychologyOutlined";
import { CompetencyGroups } from "@/components/common/CompetencyGroups";
import { getApiErrorMessage } from "@/lib/api";
import { fetchCompetenciaCatalog, updateCompetencias } from "@/lib/student";
import type { CatalogoCompetenciaResponse, CompetenciaResponse } from "@/types/student";
import { FormDialog } from "./FormDialog";
import { SectionCard } from "./SectionCard";
import type { SectionProps } from "./sectionProps";

// Same limit the API enforces for behavioral competencies.
const MAX_COMPORTAMENTAIS = 6;

export function CompetenciasSection({ profile, onChanged, notify }: SectionProps) {
  const [open, setOpen] = useState(false);
  const competencias = profile.competencias;

  return (
    <SectionCard
      title="Competências"
      help="Os recrutadores filtram a busca por elas."
      editLabel="Editar competências"
      onEdit={() => setOpen(true)}
      isEmpty={competencias.length === 0}
      emptyMessage="Mostre suas habilidades"
      emptyDescription="Selecione as competências que representam suas habilidades."
      emptyActionLabel="Adicionar competências"
      emptyIcon={<PsychologyOutlined />}
    >
      <CompetencyGroups competencias={competencias} color="primary" variant="outlined" />
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
  selecionadas: CompetenciaResponse[];
  onClose: () => void;
  onSaved: () => void;
}

function CompetenciasForm({ selecionadas, onClose, onSaved }: CompetenciasFormProps) {
  const [selecaoIds, setSelecaoIds] = useState(() => selecionadas.map((item) => item.id));
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
  const tecnicas = opcoes.filter((item) => item.tipo === "TECNICA");
  const comportamentais = opcoes.filter((item) => item.tipo === "COMPORTAMENTAL");
  const selecaoTecnicas = tecnicas.filter((item) => selecaoIds.includes(item.id));
  const selecaoComportamentais = comportamentais.filter((item) => selecaoIds.includes(item.id));
  const catalogoLoading = catalogo === null && !catalogoError;

  // Replaces the selection of one group (technical or behavioral) and keeps the other one untouched.
  function replaceGroup(grupo: CatalogoCompetenciaResponse[], novos: CatalogoCompetenciaResponse[]) {
    setSelecaoIds((atuais) => [
      ...atuais.filter((id) => !grupo.some((item) => item.id === id)),
      ...novos.map((item) => item.id),
    ]);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Only controlled catalog IDs are sent; no skill levels in this phase.
      await updateCompetencias({ competenciaIds: selecaoIds });
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
          Selecione quantas competências técnicas quiser do catálogo do Rio Pomba Valley.
        </Typography>
        <CompetenciasField
          label="Competências técnicas"
          placeholder="Buscar competência técnica"
          options={tecnicas}
          value={selecaoTecnicas}
          onChange={(novos) => replaceGroup(tecnicas, novos)}
          disabled={saving || catalogoLoading}
          loading={catalogoLoading}
        />
        <Typography variant="body2" color="text.secondary">
          Escolha até {MAX_COMPORTAMENTAIS} competências comportamentais, as que mais combinam com você.
        </Typography>
        <CompetenciasField
          label="Competências comportamentais"
          placeholder="Buscar competência comportamental"
          options={comportamentais}
          value={selecaoComportamentais}
          onChange={(novos) => replaceGroup(comportamentais, novos)}
          disabled={saving || catalogoLoading}
          loading={catalogoLoading}
          limit={MAX_COMPORTAMENTAIS}
        />
      </Stack>
    </FormDialog>
  );
}

interface CompetenciasFieldProps {
  label: string;
  placeholder: string;
  options: CatalogoCompetenciaResponse[];
  value: CatalogoCompetenciaResponse[];
  onChange: (value: CatalogoCompetenciaResponse[]) => void;
  disabled: boolean;
  loading: boolean;
  limit?: number;
}

function CompetenciasField({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  loading,
  limit,
}: CompetenciasFieldProps) {
  const limitReached = limit !== undefined && value.length >= limit;

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      options={options}
      groupBy={(option) => option.categoria}
      value={value}
      onChange={(_, novos) => onChange(novos)}
      getOptionLabel={(option) => option.nome}
      getOptionDisabled={(option) =>
        limitReached && !value.some((item) => item.id === option.id)
      }
      isOptionEqualToValue={(option, selecionada) => option.id === selecionada.id}
      loading={loading}
      disabled={disabled}
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
          label={label}
          placeholder={placeholder}
          helperText={limit !== undefined ? `${value.length} de ${limit} selecionadas` : undefined}
        />
      )}
    />
  );
}
