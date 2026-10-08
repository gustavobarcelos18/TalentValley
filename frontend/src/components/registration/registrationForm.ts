import { municipioCache, findMunicipio, validateCep } from "./location";
import {
  normalizeWhitespace,
  validateBrazilianPhone,
  validateCityName,
  validateEmail,
  validatePersonName,
  validateUF,
} from "@/lib/validation";

export type FieldErrors = Record<string, string | null>;

export type CommonForm = {
  nomeCompleto: string;
  email: string;
  telefone: string;
  cep: string;
  cidade: string;
  uf: string;
};

export const commonBlank: CommonForm = {
  nomeCompleto: "",
  email: "",
  telefone: "",
  cep: "",
  cidade: "",
  uf: "",
};

// Reference to a field's focusable control. MUI Select exposes an imperative
// handle with `focus` instead of a DOM node, so both shapes are accepted.
export type FocusableControl = { focus: () => void } | null;

export const CONSENT_ERROR = "Você deve aceitar os termos para continuar.";

export const LGPD_CONSENT_ERROR = "Você deve autorizar o tratamento dos dados essenciais para continuar.";

export function validateConsent(accepted: boolean): string | null {
  return accepted ? null : CONSENT_ERROR;
}

// Both mandatory consents gate the submission: the terms/privacy acceptance and
// the LGPD essential data treatment. Each one is reported under its own key so
// the review step can focus and show the right error.
export function validateConsents(termsAccepted: boolean, essentialAccepted: boolean): FieldErrors {
  return {
    consentTermos: validateConsent(termsAccepted),
    consentLgpdEssencial: essentialAccepted ? null : LGPD_CONSENT_ERROR,
  };
}

// The submitted city must belong to the selected UF. This only enforces the
// combination when the official municipality list for that UF is already
// loaded, so an IBGE lookup failure never invalidates a legitimate selection.
function validateCityState(form: CommonForm): string | null {
  const city = normalizeWhitespace(form.cidade);
  if (!city) return null;
  const municipios = municipioCache.get(form.uf);
  if (!municipios) return null;
  return findMunicipio(municipios, city)
    ? null
    : "A cidade informada não pertence ao estado selecionado.";
}

export function commonErrors(form: CommonForm): FieldErrors {
  return {
    nomeCompleto: validatePersonName(form.nomeCompleto),
    email: validateEmail(form.email),
    telefone: validateBrazilianPhone(form.telefone),
    cep: validateCep(form.cep),
    cidade: validateCityName(form.cidade) ?? validateCityState(form),
    uf: validateUF(form.uf),
  };
}

export function firstError(errors: FieldErrors): string | null {
  return (
    Object.values(errors).find((error): error is string => Boolean(error)) ??
    null
  );
}
