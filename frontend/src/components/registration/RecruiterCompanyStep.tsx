"use client";

import { AuthField } from "@/components/auth/AuthField";
import { stripEmoji, stripEmojiOnPaste } from "@/lib/validation";
import type { FieldErrors, FocusableControl } from "./registrationForm";

export type RecruiterCompanyForm = {
  empresa: string;
  cargo: string;
  siteEmpresa: string;
};

export const recruiterCompanyBlank: RecruiterCompanyForm = {
  empresa: "",
  cargo: "",
  siteEmpresa: "",
};

interface RecruiterCompanyStepProps {
  value: RecruiterCompanyForm;
  errors: FieldErrors;
  onChange: (key: keyof RecruiterCompanyForm, value: string) => void;
  onBlur: (key: keyof RecruiterCompanyForm) => void;
  registerFieldRef: (key: string) => (node: FocusableControl) => void;
  disabled: boolean;
}

// Step "Empresa" of the recruiter wizard: where the recruiter works and in
// which role.
export function RecruiterCompanyStep({
  value,
  errors,
  onChange,
  onBlur,
  registerFieldRef,
  disabled,
}: RecruiterCompanyStepProps) {
  return (
    <>
      <AuthField
        id="empresa"
        name="empresa"
        label="Empresa"
        value={value.empresa}
        onChange={(e) => onChange("empresa", stripEmoji(e.target.value).slice(0, 150))}
        onBlur={() => onBlur("empresa")}
        onPaste={stripEmojiOnPaste}
        inputRef={registerFieldRef("empresa")}
        disabled={disabled}
        error={Boolean(errors.empresa)}
        helperText={errors.empresa}
        autoComplete="organization"
        maxLength={150}
      />

      <AuthField
        id="cargo"
        name="cargo"
        label="Cargo"
        value={value.cargo}
        onChange={(e) => onChange("cargo", stripEmoji(e.target.value).slice(0, 120))}
        onBlur={() => onBlur("cargo")}
        onPaste={stripEmojiOnPaste}
        inputRef={registerFieldRef("cargo")}
        disabled={disabled}
        error={Boolean(errors.cargo)}
        helperText={errors.cargo}
        autoComplete="organization-title"
        maxLength={120}
      />

      <div className="sm:col-span-2">
        <AuthField
          id="siteEmpresa"
          name="siteEmpresa"
          label="Site da empresa"
          type="url"
          required={false}
          value={value.siteEmpresa}
          onChange={(e) => onChange("siteEmpresa", stripEmoji(e.target.value).slice(0, 2048))}
          onBlur={() => onBlur("siteEmpresa")}
          onPaste={stripEmojiOnPaste}
          inputRef={registerFieldRef("siteEmpresa")}
          disabled={disabled}
          error={Boolean(errors.siteEmpresa)}
          helperText={errors.siteEmpresa ?? "Opcional; use um endereço HTTP ou HTTPS."}
          inputMode="url"
          maxLength={2048}
        />
      </div>
    </>
  );
}
