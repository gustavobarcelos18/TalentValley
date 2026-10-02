"use client";

import { useEffect, useRef } from "react";
import { Autocomplete, Button, CircularProgress, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { AuthField } from "@/components/auth/AuthField";
import {
  applyCepPaste,
  caretAfterDigits,
  findMunicipio,
  formatCep,
  municipioFilter,
} from "./location";
import type { CommonForm, FieldErrors, FocusableControl } from "./registrationForm";
import type { CepStatus } from "./useCepLookup";
import { useMunicipios } from "./useMunicipios";
import {
  BRAZILIAN_UFS,
  sanitizeCityName,
  sanitizePersonName,
  stripEmoji,
  stripEmojiOnPaste,
} from "@/lib/validation";

interface PersonalDataStepProps {
  value: CommonForm;
  errors: FieldErrors;
  onChange: (key: keyof CommonForm, value: string) => void;
  onBlur: (key: keyof CommonForm) => void;
  registerFieldRef: (key: string) => (node: FocusableControl) => void;
  disabled: boolean;
  /** Status of the CEP lookup, which lives in the form so it survives step changes. */
  cepStatus: CepStatus;
}

// Step "Dados pessoais": identification, contact and location. Shared by the
// student and recruiter wizards.
export function PersonalDataStep({
  value,
  errors,
  onChange,
  onBlur,
  registerFieldRef,
  disabled,
  cepStatus,
}: PersonalDataStepProps) {
  const { municipios, loading, error, retry } = useMunicipios(value.uf);
  const selectedCity = municipios.find((m) => m.nome === value.cidade) ?? null;

  // When the official list recovers from an IBGE error, reconcile a manually
  // typed city: normalize it to the official name when it matches, otherwise
  // clear it so an invalid Cidade/UF pair can never be silently submitted or
  // left hidden behind the Autocomplete.
  const wasErrorRef = useRef(error);
  useEffect(() => {
    const wasError = wasErrorRef.current;
    if (error) {
      wasErrorRef.current = true;
      return;
    }
    if (municipios.length === 0) return;
    if (wasError && value.cidade) {
      const match = findMunicipio(municipios, value.cidade);
      onChange("cidade", match ? match.nome : "");
    }
    wasErrorRef.current = false;
  }, [error, municipios, value.cidade, onChange]);

  return (
    <>
      <AuthField
        id="nomeCompleto"
        name="nomeCompleto"
        label="Nome completo"
        autoComplete="name"
        value={value.nomeCompleto}
        onChange={(e) => onChange("nomeCompleto", sanitizePersonName(e.target.value))}
        onBlur={() => onBlur("nomeCompleto")}
        onPaste={stripEmojiOnPaste}
        inputRef={registerFieldRef("nomeCompleto")}
        disabled={disabled}
        error={Boolean(errors.nomeCompleto)}
        helperText={errors.nomeCompleto}
        maxLength={150}
      />

      <AuthField
        id="email"
        name="email"
        label="E-mail"
        type="email"
        autoComplete="email"
        value={value.email}
        onChange={(e) => onChange("email", stripEmoji(e.target.value).slice(0, 254))}
        onBlur={() => onBlur("email")}
        onPaste={stripEmojiOnPaste}
        inputRef={registerFieldRef("email")}
        disabled={disabled}
        error={Boolean(errors.email)}
        helperText={errors.email}
        maxLength={254}
      />

      <AuthField
        id="telefone"
        name="telefone"
        label="Telefone"
        type="tel"
        autoComplete="tel"
        value={value.telefone}
        onChange={(e) => onChange("telefone", stripEmoji(e.target.value))}
        onBlur={() => onBlur("telefone")}
        onPaste={stripEmojiOnPaste}
        inputRef={registerFieldRef("telefone")}
        disabled={disabled}
        error={Boolean(errors.telefone)}
        helperText={errors.telefone ?? "Ex.: (32) 99999-9999"}
        inputMode="tel"
      />

      <AuthField
        id="cep"
        name="cep"
        label="CEP"
        required={false}
        autoComplete="postal-code"
        value={value.cep}
        onChange={(event) => {
          const input = event.currentTarget;
          const raw = input.value;
          const caret = input.selectionStart ?? raw.length;
          const next = formatCep(raw);
          onChange("cep", next);
          const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, "").length;
          requestAnimationFrame(() => {
            const position = caretAfterDigits(next, digitsBeforeCaret);
            input.setSelectionRange(position, position);
          });
        }}
        onBlur={() => onBlur("cep")}
        // Take over the paste so maxLength cannot truncate the raw clipboard
        // text before formatting ("36.700-120" would lose its last digit).
        onPaste={(event) => {
          const input = event.currentTarget;
          const selectionStart = input.selectionStart ?? input.value.length;
          const selectionEnd = input.selectionEnd ?? selectionStart;
          const pasted = applyCepPaste(
            input.value,
            selectionStart,
            selectionEnd,
            event.clipboardData.getData("text/plain"),
          );
          // Clipboard without digits: keep the native paste and let the
          // regular onChange formatter normalize the field.
          if (!pasted) return;
          event.preventDefault();
          onChange("cep", pasted.value);
          requestAnimationFrame(() => {
            const position = caretAfterDigits(pasted.value, pasted.digitsBeforeCaret);
            input.setSelectionRange(position, position);
          });
        }}
        onKeyDown={(event) => {
          if (event.key !== "Backspace") return;
          const input = event.currentTarget;
          const caret = input.selectionStart ?? input.value.length;
          if (caret <= 0 || input.value.charAt(caret - 1) !== "-") return;
          event.preventDefault();
          const before = input.value.slice(0, caret - 1);
          const next = formatCep(before.slice(0, -1) + input.value.slice(caret));
          onChange("cep", next);
          const digitsBeforeCaret = before.slice(0, -1).replace(/\D/g, "").length;
          requestAnimationFrame(() => {
            const position = caretAfterDigits(next, digitsBeforeCaret);
            input.setSelectionRange(position, position);
          });
        }}
        inputRef={registerFieldRef("cep")}
        disabled={disabled}
        error={Boolean(errors.cep)}
        helperText={errors.cep ?? "Opcional; 8 dígitos para preencher Cidade e UF."}
        inputMode="numeric"
        maxLength={9}
        endAdornment={cepStatus.type === "loading" ? <CircularProgress size={16} /> : undefined}
      />

      {(cepStatus.type === "success" || cepStatus.type === "error") && (
        <Typography
          component="p"
          variant="caption"
          role="status"
          className="sm:col-span-2"
          sx={{ color: cepStatus.type === "error" ? "error.main" : "success.main" }}
        >
          {cepStatus.type === "error"
            ? cepStatus.message
            : cepStatus.message ?? "Cidade e UF preenchidas pelo CEP."}
        </Typography>
      )}

      <div className="grid grid-cols-[6.5rem_1fr] items-start gap-4 sm:col-span-2">
        <AuthField
          id="uf"
          name="uf"
          label="Estado"
          select
          value={value.uf}
          onChange={(e) => {
            const nextUf = e.target.value;
            onChange("uf", nextUf);
            // Changing the state invalidates the previously selected city so an
            // incompatible Cidade/Estado combination can never be submitted.
            if (nextUf !== value.uf) {
              onChange("cidade", "");
            }
          }}
          onBlur={() => onBlur("uf")}
          inputRef={registerFieldRef("uf")}
          disabled={disabled}
          error={Boolean(errors.uf)}
          helperText={errors.uf}
        >
          <MenuItem value="">Selecione</MenuItem>
          {BRAZILIAN_UFS.map((uf) => (
            <MenuItem key={uf} value={uf}>
              {uf}
            </MenuItem>
          ))}
        </AuthField>

        {error ? (
          <AuthField
            id="cidade"
            name="cidade"
            label="Cidade"
            autoComplete="address-level2"
            value={value.cidade}
            onChange={(e) => onChange("cidade", sanitizeCityName(e.target.value))}
            onBlur={() => onBlur("cidade")}
            onPaste={stripEmojiOnPaste}
            inputRef={registerFieldRef("cidade")}
            disabled={disabled}
            error={Boolean(errors.cidade)}
            helperText={errors.cidade}
            maxLength={120}
          />
        ) : (
          <Autocomplete
            id="cidade"
            value={selectedCity}
            onChange={(_event, newValue) => onChange("cidade", newValue ? newValue.nome : "")}
            options={municipios}
            getOptionLabel={(option) => option.nome}
            isOptionEqualToValue={(option, selected) => option.id === selected.id}
            loading={loading}
            loadingText="Carregando cidades..."
            noOptionsText="Nenhuma cidade encontrada."
            disabled={disabled || !value.uf}
            fullWidth
            filterOptions={municipioFilter}
            renderInput={(params) => (
              <TextField
                {...params}
                required
                slotProps={{
                  ...params.slotProps,
                  htmlInput: {
                    ...params.slotProps.htmlInput,
                    value: params.slotProps.htmlInput.value ?? "",
                    onPaste: stripEmojiOnPaste,
                  },
                }}
                label="Cidade"
                placeholder={value.uf ? "Busque e selecione" : "Escolha o estado"}
                onBlur={() => onBlur("cidade")}
                inputRef={registerFieldRef("cidade")}
                error={Boolean(errors.cidade)}
                helperText={errors.cidade}
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
      </div>

      {error && (
        <Stack direction="row" spacing={1} useFlexGap className="sm:col-span-2" sx={{ alignItems: "center", flexWrap: "wrap" }}>
          <Typography component="span" variant="caption" color="text.secondary" role="status">
            Não foi possível carregar a lista oficial. Digite a cidade manualmente ou tente novamente.
          </Typography>
          <Button size="small" type="button" onClick={retry}>
            Tentar novamente
          </Button>
        </Stack>
      )}
    </>
  );
}
