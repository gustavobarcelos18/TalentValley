"use client";

import { MenuItem, Box } from "@mui/material";
import { AuthField } from "@/components/auth/AuthField";
import { TIPO_FORMACAO_LABELS } from "@/lib/labels";
import { sanitizeIntegerInput, stripEmoji, stripEmojiOnPaste } from "@/lib/validation";
import type { TipoFormacao } from "@/types/student";
import type { FieldErrors, FocusableControl } from "./registrationForm";

export type StudentEducationForm = {
  instituicaoEnsino: string;
  curso: string;
  tipoFormacao: TipoFormacao | "";
  anoConclusaoPrevisto: string;
  relacaoRioPombaValley: string;
};

export const studentEducationBlank: StudentEducationForm = {
  instituicaoEnsino: "",
  curso: "",
  tipoFormacao: "",
  anoConclusaoPrevisto: "",
  relacaoRioPombaValley: "",
};

const formations = Object.keys(TIPO_FORMACAO_LABELS) as TipoFormacao[];

interface StudentEducationStepProps {
  value: StudentEducationForm;
  errors: FieldErrors;
  onChange: (key: keyof StudentEducationForm, value: string) => void;
  onBlur: (key: keyof StudentEducationForm) => void;
  registerFieldRef: (key: string) => (node: FocusableControl) => void;
  disabled: boolean;
}

// Step "Formação" of the student wizard: where the student studies and the
// optional link with the Rio Pomba Valley community.
export function StudentEducationStep({
  value,
  errors,
  onChange,
  onBlur,
  registerFieldRef,
  disabled,
}: StudentEducationStepProps) {
  return (
    <>
      <AuthField
        id="instituicaoEnsino"
        name="instituicaoEnsino"
        label="Instituição de ensino"
        value={value.instituicaoEnsino}
        onChange={(e) => onChange("instituicaoEnsino", stripEmoji(e.target.value).slice(0, 180))}
        onBlur={() => onBlur("instituicaoEnsino")}
        onPaste={stripEmojiOnPaste}
        inputRef={registerFieldRef("instituicaoEnsino")}
        disabled={disabled}
        error={Boolean(errors.instituicaoEnsino)}
        helperText={errors.instituicaoEnsino}
        maxLength={180}
      />

      <AuthField
        id="curso"
        name="curso"
        label="Curso"
        value={value.curso}
        onChange={(e) => onChange("curso", stripEmoji(e.target.value).slice(0, 180))}
        onBlur={() => onBlur("curso")}
        onPaste={stripEmojiOnPaste}
        inputRef={registerFieldRef("curso")}
        disabled={disabled}
        error={Boolean(errors.curso)}
        helperText={errors.curso}
        maxLength={180}
      />

      <AuthField
        id="tipoFormacao"
        name="tipoFormacao"
        label="Tipo de formação"
        select
        value={value.tipoFormacao}
        onChange={(e) => onChange("tipoFormacao", e.target.value)}
        onBlur={() => onBlur("tipoFormacao")}
        inputRef={registerFieldRef("tipoFormacao")}
        disabled={disabled}
        error={Boolean(errors.tipoFormacao)}
        helperText={errors.tipoFormacao}
      >
        {formations.map((type) => (
          <MenuItem key={type} value={type}>
            {TIPO_FORMACAO_LABELS[type]}
          </MenuItem>
        ))}
      </AuthField>

      <AuthField
        id="anoConclusaoPrevisto"
        name="anoConclusaoPrevisto"
        label="Ano previsto de conclusão"
        required={false}
        value={value.anoConclusaoPrevisto}
        onChange={(e) => onChange("anoConclusaoPrevisto", sanitizeIntegerInput(e.target.value, 4))}
        onBlur={() => onBlur("anoConclusaoPrevisto")}
        inputRef={registerFieldRef("anoConclusaoPrevisto")}
        disabled={disabled}
        error={Boolean(errors.anoConclusaoPrevisto)}
        helperText={errors.anoConclusaoPrevisto ?? "Opcional; use quatro dígitos."}
        inputMode="numeric"
        maxLength={4}
      />

      <AuthField
        id="relacaoRioPombaValley"
        name="relacaoRioPombaValley"
        label="Relação com o Rio Pomba Valley"
        required={false}
        multiline
        minRows={3}
        value={value.relacaoRioPombaValley}
        onChange={(e) => onChange("relacaoRioPombaValley", stripEmoji(e.target.value).slice(0, 500))}
        onBlur={() => onBlur("relacaoRioPombaValley")}
        onPaste={stripEmojiOnPaste}
        inputRef={registerFieldRef("relacaoRioPombaValley")}
        disabled={disabled}
        error={Boolean(errors.relacaoRioPombaValley)}
        helperText={
          <Box component="span" sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Box component="span">{errors.relacaoRioPombaValley ?? "Opcional; compartilhe seu vínculo com a comunidade."}</Box>
            <Box component="span" sx={{ color: "text.secondary" }}>
              {value.relacaoRioPombaValley.length} / 500
            </Box>
          </Box>
        }
        maxLength={500}
      />
    </>
  );
}
