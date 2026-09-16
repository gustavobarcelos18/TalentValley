"use client";

import { useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  AVAILABILITIES,
  FORMATION_STATUSES,
  FORMATION_TYPES,
  MODALITIES,
} from "@/lib/recruiter-search";
import {
  DISPONIBILIDADE_LABELS,
  MODALIDADE_LABELS,
  STATUS_FORMACAO_LABELS,
  TIPO_FORMACAO_LABELS,
} from "@/lib/labels";
import { normalizeUF, validateSearchTerm, validateUF } from "@/lib/validation";
import type { CatalogoCompetenciaResponse } from "@/types/student";
import type { TalentSearchFilters } from "@/types/recruiter";

interface TalentFiltersProps {
  value: TalentSearchFilters;
  onChange: (value: TalentSearchFilters) => void;
  onApply: () => void;
  onClear: () => void;
  competencies: CatalogoCompetenciaResponse[];
  catalogError: string | null;
  retryCatalog: () => void;
}

export function TalentFilters({
  value,
  onChange,
  onApply,
  onClear,
  competencies,
  catalogError,
  retryCatalog,
}: TalentFiltersProps) {
  const [error, setError] = useState<string | null>(null);
  function set<K extends keyof TalentSearchFilters>(
    key: K,
    next: TalentSearchFilters[K],
  ) {
    onChange({ ...value, [key]: next });
  }
  function toggle<T extends string>(
    key:
      "tiposFormacao" | "statusFormacao" | "disponibilidades" | "modalidades",
    item: T,
  ) {
    const current = value[key] as string[];
    set(
      key,
      (current.includes(item)
        ? current.filter((entry) => entry !== item)
        : [...current, item]) as TalentSearchFilters[typeof key],
    );
  }

  const apply = () => {
    const validation =
      validateSearchTerm(value.nome, 150) ??
      validateSearchTerm(value.cidade, 120) ??
      validateSearchTerm(value.formacaoNome, 200) ??
      (value.uf ? validateUF(value.uf) : null);
    setError(validation);
    if (!validation) onApply();
  };
  return (
    <Stack
      component="form"
      spacing={2.5}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      {error && <Alert severity="error">{error}</Alert>}
      <TextField
        label="Nome"
        value={value.nome}
        onChange={(event) => set("nome", event.target.value.slice(0, 150))}
        slotProps={{ htmlInput: { maxLength: 150 } }}
        fullWidth
      />
      <Stack direction="row" spacing={1}>
        <TextField
          label="Cidade"
          value={value.cidade}
          onChange={(event) => set("cidade", event.target.value.slice(0, 120))}
          slotProps={{ htmlInput: { maxLength: 120 } }}
          fullWidth
        />
        <TextField
          label="UF"
          value={value.uf}
          onChange={(event) =>
            set("uf", normalizeUF(event.target.value).replace(/[^A-Z]/g, ""))
          }
          slotProps={{ htmlInput: { maxLength: 2 } }}
          sx={{ width: 92 }}
        />
      </Stack>
      <Box>
        <Autocomplete
          multiple
          options={competencies}
          value={competencies.filter((item) =>
            value.competenciaIds.includes(item.id),
          )}
          getOptionLabel={(option) => option.nome}
          isOptionEqualToValue={(option, selected) => option.id === selected.id}
          onChange={(_, selected) =>
            set(
              "competenciaIds",
              selected.map((item) => item.id),
            )
          }
          renderInput={(params) => (
            <TextField
              {...params}
              label="Competências"
              placeholder="Selecione"
            />
          )}
        />
        {catalogError && (
          <Alert
            severity="warning"
            sx={{ mt: 1 }}
            action={
              <Button color="inherit" size="small" onClick={retryCatalog}>
                Tentar novamente
              </Button>
            }
          >
            {catalogError}
          </Alert>
        )}
      </Box>
      <TextField
        label="Nome da formação"
        value={value.formacaoNome}
        onChange={(event) =>
          set("formacaoNome", event.target.value.slice(0, 200))
        }
        slotProps={{ htmlInput: { maxLength: 200 } }}
        fullWidth
      />
      <CheckSection label="Tipo de formação">
        {FORMATION_TYPES.map((item) => (
          <FormControlLabel
            key={item}
            control={
              <Checkbox
                size="small"
                checked={value.tiposFormacao.includes(item)}
                onChange={() => toggle("tiposFormacao", item)}
              />
            }
            label={TIPO_FORMACAO_LABELS[item]}
          />
        ))}
      </CheckSection>
      <CheckSection label="Status da formação">
        {FORMATION_STATUSES.map((item) => (
          <FormControlLabel
            key={item}
            control={
              <Checkbox
                size="small"
                checked={value.statusFormacao.includes(item)}
                onChange={() => toggle("statusFormacao", item)}
              />
            }
            label={STATUS_FORMACAO_LABELS[item]}
          />
        ))}
      </CheckSection>
      <FormControlLabel
        control={
          <Checkbox
            checked={value.rpvVerificado}
            onChange={(event) => set("rpvVerificado", event.target.checked)}
          />
        }
        label="Somente formação RPV verificada"
      />
      <CheckSection label="Disponibilidade">
        {AVAILABILITIES.map((item) => (
          <FormControlLabel
            key={item}
            control={
              <Checkbox
                size="small"
                checked={value.disponibilidades.includes(item)}
                onChange={() => toggle("disponibilidades", item)}
              />
            }
            label={DISPONIBILIDADE_LABELS[item]}
          />
        ))}
      </CheckSection>
      <CheckSection label="Modalidade">
        {MODALITIES.map((item) => (
          <FormControlLabel
            key={item}
            control={
              <Checkbox
                size="small"
                checked={value.modalidades.includes(item)}
                onChange={() => toggle("modalidades", item)}
              />
            }
            label={MODALIDADE_LABELS[item]}
          />
        ))}
      </CheckSection>
      <Stack direction="row" spacing={1}>
        <Button type="submit" variant="contained" fullWidth>
          Aplicar
        </Button>
        <Button type="button" variant="outlined" onClick={onClear}>
          Limpar
        </Button>
      </Stack>
    </Stack>
  );
}

function CheckSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0 }}>
      <Typography component="legend" variant="subtitle2" sx={{ mb: 0.5 }}>
        {label}
      </Typography>
      <FormGroup>{children}</FormGroup>
    </Box>
  );
}
