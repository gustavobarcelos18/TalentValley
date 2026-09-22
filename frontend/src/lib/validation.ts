import type { ClipboardEvent } from "react";

export const PASSWORD_HELPER_TEXT =
  "Mínimo de 8 caracteres, com maiúscula, minúscula e dígito.";

export const BRAZILIAN_UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const ufSet = new Set<string>(BRAZILIAN_UFS);
const emojiReplacePattern =
  /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D\u20E3\u{E0020}-\u{E007F}]/gu;
const emojiTestPattern =
  /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D\u20E3\u{E0020}-\u{E007F}]/u;
const keycapReplacePattern = /[#*0-9]\uFE0F?\u20E3/gu;
const keycapTestPattern = /[#*0-9]\uFE0F?\u20E3/u;
const controlPattern = /[\p{Cc}\p{Cf}]/u;
const personOrCityPattern = /^[\p{L}][\p{L}\p{M}'’ -]*$/u;

export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeEmailInput(value: string): string {
  return value.trim().toLowerCase();
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Stores Brazilian numbers as their 10 or 11 national digits, without +55. */
export function normalizePhone(value: string): string {
  const digits = digitsOnly(value);
  return (digits.length === 12 || digits.length === 13) &&
    digits.startsWith("55")
    ? digits.slice(2)
    : digits;
}

export function formatBrazilianPhone(value: string): string {
  const digits = normalizePhone(value);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const subscriber = digits.slice(2);
  if (subscriber.length <= 4) return `(${digits.slice(0, 2)}) ${subscriber}`;
  const splitAt = subscriber.length > 8 ? 5 : 4;
  return `(${digits.slice(0, 2)}) ${subscriber.slice(0, splitAt)}-${subscriber.slice(splitAt)}`;
}

export function normalizeUF(value: string): string {
  return value.trim().toUpperCase().slice(0, 2);
}

export function normalizeOptionalUrl(value: string): string | null {
  const normalized = value.trim();
  return normalized || null;
}

/** Filters only characters which can never be part of a person name. */
export function sanitizePersonName(value: string): string {
  return stripEmoji(value.replace(/[\p{N}\p{Cc}\p{Cf}]/gu, "")).slice(0, 150);
}

export function sanitizeCityName(value: string): string {
  return stripEmoji(value.replace(/[\p{N}\p{Cc}\p{Cf}]/gu, "")).slice(0, 120);
}

export function sanitizeIntegerInput(value: string, maxLength = 9): string {
  return digitsOnly(value).slice(0, maxLength);
}

/** Removes emoji from non-password user-editable text, including pasted input. */
export function stripEmoji(value: string): string {
  return value
    .replace(keycapReplacePattern, "")
    .replace(emojiReplacePattern, "");
}

export function containsEmoji(value: string): boolean {
  return emojiTestPattern.test(value) || keycapTestPattern.test(value);
}

export function sanitizeBio(value: string): string {
  return stripEmoji(value).slice(0, 1500);
}

/**
 * Paste guard: strips emoji characters from clipboard content before they
 * enter the field. If the pasted text contains no emoji, the paste proceeds
 * normally. Used as an `onPaste` handler on text inputs.
 */
export function stripEmojiOnPaste(
  event: ClipboardEvent<HTMLInputElement | HTMLTextAreaElement>,
): void {
  const pasted = event.clipboardData.getData("text/plain");
  if (!containsEmoji(pasted)) return;
  event.preventDefault();
  document.execCommand("insertText", false, stripEmoji(pasted));
}

export function validateRequired(
  value: string | null | undefined,
  label = "Este campo",
): string | null {
  return !value || !value.trim() ? `${label} é obrigatório.` : null;
}

function hasForbiddenText(value: string): boolean {
  return controlPattern.test(value) || containsEmoji(value);
}

export function validatePersonName(value: string): string | null {
  const name = normalizeWhitespace(value);
  if (
    name.length < 3 ||
    name.length > 150 ||
    !personOrCityPattern.test(name) ||
    hasForbiddenText(name)
  ) {
    return "Informe um nome válido, sem números.";
  }
  return null;
}

export function validateCityName(value: string): string | null {
  const city = normalizeWhitespace(value);
  if (
    city.length < 2 ||
    city.length > 120 ||
    !personOrCityPattern.test(city) ||
    hasForbiddenText(city)
  ) {
    return "Informe uma cidade válida, sem números.";
  }
  return null;
}

export function validateEmail(value: string, required = true): string | null {
  const email = value.trim();
  if (!email) return required ? "Informe seu e-mail." : null;
  if (
    email.length > 254 ||
    /\s/.test(email) ||
    hasForbiddenText(email) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    return "Informe um e-mail válido.";
  }
  return null;
}

export function validateBrazilianPhone(
  value: string,
  required = true,
): string | null {
  if (!value.trim())
    return required ? "Informe um telefone brasileiro válido." : null;
  if (!/^[0-9 ()+.\-]+$/.test(value))
    return "Informe um telefone brasileiro válido.";
  const digits = normalizePhone(value);
  if (
    !/^\d{10,11}$/.test(digits) ||
    /^(\d)\1+$/.test(digits) ||
    digits.slice(0, 2) === "00"
  ) {
    return "Informe um telefone brasileiro válido.";
  }
  return null;
}

export function validateUF(value: string): string | null {
  return ufSet.has(value.trim().toUpperCase())
    ? null
    : "Selecione uma UF válida.";
}

export function validateHttpUrl(
  value: string | null | undefined,
  required = false,
): string | null {
  const candidate = value?.trim() ?? "";
  if (!candidate) return required ? "Informe uma URL." : null;
  if (/\s|[\p{Cc}\p{Cf}]/u.test(candidate) || containsEmoji(candidate))
    return "Informe uma URL válida.";
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.hostname
        ? null
        : "Informe uma URL válida."
      : "Informe uma URL começando com http:// ou https://.";
  } catch {
    return "Informe uma URL válida.";
  }
}

export function validateSearchTerm(
  value: string,
  maxLength = 150,
): string | null {
  const candidate = value.trim();
  if (candidate.length > maxLength)
    return `A busca deve ter no máximo ${maxLength} caracteres.`;
  if (controlPattern.test(candidate) || containsEmoji(candidate))
    return "Informe uma busca válida.";
  return null;
}

export function validateInteger(
  value: string | number | null | undefined,
  required = false,
): string | null {
  if (value === null || value === undefined || value === "")
    return required ? "Use apenas números." : null;
  return /^\d+$/.test(String(value)) ? null : "Use apenas números.";
}

export function validatePositiveInteger(
  value: string | number | null | undefined,
  required = false,
): string | null {
  const error = validateInteger(value, required);
  if (error || value === null || value === undefined || value === "")
    return error;
  return Number(value) > 0 ? null : "Informe um número positivo.";
}

export function validateIntegerRange(
  value: string | number | null | undefined,
  min: number,
  max: number,
): string | null {
  const error = validateInteger(value);
  if (error || value === null || value === undefined || value === "")
    return error;
  const number = Number(value);
  return number >= min && number <= max
    ? null
    : `Informe um valor entre ${min} e ${max}.`;
}

export function validateYear(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const candidate = String(value);
  if (!/^\d{4}$/.test(candidate)) return "Informe um ano com 4 dígitos.";
  const year = Number(candidate);
  const currentYear = new Date().getFullYear();
  return year >= 1900 && year <= currentYear + 15
    ? null
    : `Informe um ano entre 1900 e ${currentYear + 15}.`;
}

export function validateIsoDate(
  value: string,
  required = false,
): string | null {
  if (!value) return required ? "Informe uma data." : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Informe uma data válida.";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? null
    : "Informe uma data válida.";
}

export function validateBrazilianDateInput(value: string): string | null {
  if (!value) return null;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return "Use o formato dd/mm/aaaa.";
  const [day, month, year] = value.split("/").map(Number);
  return validateIsoDate(
    `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
    true,
  );
}

export function validateDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start || !end) return null;
  return start <= end
    ? null
    : "A data final não pode ser anterior à data inicial.";
}

export function validateTextLength(
  value: string,
  min: number,
  max: number,
  label = "valor",
): string | null {
  const text = normalizeWhitespace(value);
  if (text.length < min || text.length > max || hasForbiddenText(text))
    return `Informe ${label} entre ${min} e ${max} caracteres.`;
  return null;
}

export function validateMeaningfulText(
  value: string,
  min: number,
  max: number,
  label = "um valor",
): string | null {
  const text = normalizeWhitespace(value);
  if (
    text.length < min ||
    text.length > max ||
    hasForbiddenText(text) ||
    !/[\p{L}\p{N}]/u.test(text)
  ) {
    return `Informe ${label} válido.`;
  }
  return null;
}

export const validateCompanyName = (value: string) =>
  validateMeaningfulText(value, 2, 150, "uma empresa");
export const validateJobTitle = (value: string) =>
  validateMeaningfulText(value, 2, 150, "um cargo");
export const validateInstitutionName = (value: string) =>
  validateMeaningfulText(value, 2, 200, "uma instituição");
export const validateCourseName = (value: string) =>
  validateMeaningfulText(value, 2, 200, "um curso");
export const validateProjectName = (value: string) =>
  validateMeaningfulText(value, 2, 200, "um nome de projeto");
export const validateFreeText = (value: string, max: number) =>
  !controlPattern.test(value) && !containsEmoji(value) && value.length <= max
    ? null
    : "Revise o texto informado.";

// Compatibility names used by existing profile forms. They intentionally allow
// technology and business punctuation, unlike person-name validation.
export function validateAlphaOnly(
  value: string,
  minLength = 2,
  maxLength = 150,
): string | null {
  return validateMeaningfulText(value, minLength, maxLength);
}

export function validateAlphanumericWithPunctuation(
  value: string,
  minLength = 1,
  maxLength = 200,
): string | null {
  return validateMeaningfulText(value, minLength, maxLength);
}

export function validatePassword(senha: string): string | null {
  if (senha.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (!/[A-Z]/.test(senha))
    return "A senha deve conter pelo menos uma letra maiúscula.";
  if (!/[a-z]/.test(senha))
    return "A senha deve conter pelo menos uma letra minúscula.";
  if (!/\d/.test(senha)) return "A senha deve conter pelo menos um dígito.";
  return null;
}
