"use client";

import { useEffect } from "react";
import { Autocomplete, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { BRAZILIAN_UFS, sanitizeCityName, stripEmojiOnPaste } from "@/lib/validation";
import { findMunicipio, municipioFilter } from "./location";
import { useMunicipios } from "./useMunicipios";

interface CityStateFieldsProps {
  /** Prefix of the field ids: "dados" gives "dados-uf" and "dados-cidade". */
  idPrefix: string;
  cidade: string;
  uf: string;
  onCidadeChange: (cidade: string) => void;
  onUfChange: (uf: string) => void;
  disabled?: boolean;
}

// UF select plus a city chosen from the official IBGE list of that state, for
// forms that live outside the registration wizard. If the IBGE list cannot be
// loaded the city becomes a free text field, like in the registration.
export function CityStateFields({
  idPrefix,
  cidade,
  uf,
  onCidadeChange,
  onUfChange,
  disabled = false,
}: CityStateFieldsProps) {
  const { municipios, loading, error, retry } = useMunicipios(uf);
  const selectedCity = municipios.find((m) => m.nome === cidade) ?? null;

  // Once the official list is available, keep only a city that is on it: use
  // the official spelling when the saved or typed name matches, otherwise clear
  // it so an invalid Cidade/UF pair can never be submitted.
  useEffect(() => {
    if (error || municipios.length === 0 || !cidade) return;
    if (municipios.some((m) => m.nome === cidade)) return;
    const match = findMunicipio(municipios, cidade);
    const reconciled = match ? match.nome : "";
    if (reconciled !== cidade) onCidadeChange(reconciled);
  }, [error, municipios, cidade, onCidadeChange]);

  return (
    <>
      <TextField
        id={`${idPrefix}-uf`}
        select
        label="UF"
        value={uf}
        onChange={(event) => {
          const nextUf = event.target.value;
          onUfChange(nextUf);
          // A different state invalidates the previously selected city.
          if (nextUf !== uf) onCidadeChange("");
        }}
        required
        fullWidth
        disabled={disabled}
        slotProps={{ htmlInput: { "aria-label": "UF" } }}
      >
        {BRAZILIAN_UFS.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </TextField>

      {error ? (
        <>
          <TextField
            id={`${idPrefix}-cidade`}
            label="Cidade"
            value={cidade}
            onChange={(event) => onCidadeChange(sanitizeCityName(event.target.value))}
            required
            fullWidth
            disabled={disabled}
            slotProps={{ htmlInput: { maxLength: 120, onPaste: stripEmojiOnPaste } }}
          />
          <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: "center", flexWrap: "wrap" }}>
            <Typography component="span" variant="caption" color="text.secondary" role="status">
              Não foi possível carregar a lista oficial. Digite a cidade manualmente ou tente novamente.
            </Typography>
            <Button size="small" type="button" onClick={retry}>
              Tentar novamente
            </Button>
          </Stack>
        </>
      ) : (
        <Autocomplete
          id={`${idPrefix}-cidade`}
          value={selectedCity}
          onChange={(_event, newValue) => onCidadeChange(newValue ? newValue.nome : "")}
          options={municipios}
          getOptionLabel={(option) => option.nome}
          isOptionEqualToValue={(option, selected) => option.id === selected.id}
          loading={loading}
          loadingText="Carregando cidades..."
          noOptionsText="Nenhuma cidade encontrada."
          disabled={disabled || !uf}
          fullWidth
          filterOptions={municipioFilter}
          renderInput={(params) => (
            <TextField
              {...params}
              required
              label="Cidade"
              placeholder={uf ? "Busque e selecione" : "Escolha a UF"}
              slotProps={{
                ...params.slotProps,
                htmlInput: {
                  ...params.slotProps.htmlInput,
                  value: params.slotProps.htmlInput.value ?? "",
                  onPaste: stripEmojiOnPaste,
                },
              }}
            />
          )}
          renderOption={(props, option) => {
            const { key, ...optionProps } = props;
            return (
              <li key={key} {...optionProps}>
                {option.nome}
              </li>
            );
          }}
        />
      )}
    </>
  );
}
