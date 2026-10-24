import type { ChangeEvent, ClipboardEvent } from "react";
import { parseDateInput } from "./format";

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
  /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\u{E0020}-\u{E007F}]|\uFE0F|\u200D|\u20E3/gu;
const emojiTestPattern =
  /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\u{E0020}-\u{E007F}]|\uFE0F|\u200D|\u20E3/u;
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

/**
 * Display format. A complete number is split by its length (8 or 9 digits after the area code).
 * While the user is typing (`mobileFirst`), a number starting with 9 is already shown as 5 + 4,
 * so the hyphen does not move when the last digits arrive.
 */
export function formatBrazilianPhone(value: string, mobileFirst = false): string {
  const digits = normalizePhone(value);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  const subscriber = digits.slice(2);
  const splitAt =
    (mobileFirst && subscriber.startsWith("9")) || subscriber.length > 8 ? 5 : 4;
  if (subscriber.length <= splitAt) return `(${digits.slice(0, 2)}) ${subscriber}`;
  return `(${digits.slice(0, 2)}) ${subscriber.slice(0, splitAt)}-${subscriber.slice(splitAt)}`;
}

const PHONE_MAX_DIGITS = 11;

/**
 * Digits of a phone being typed or pasted, capped at 11. The country code is dropped only when it
 * is explicit ("+55 ...") or the value cannot be a national number (13 digits); otherwise a leading
 * 55 is the area code (Santa Maria, RS) and must stay. `removed` counts the dropped digits.
 */
function nationalPhoneDigits(value: string): { digits: string; removed: number } {
  const all = digitsOnly(value);
  const hasCountryCode =
    all.startsWith("55") && (value.trimStart().startsWith("+") || all.length === 13);
  const national = hasCountryCode ? all.slice(2) : all;
  return {
    digits: national.slice(0, PHONE_MAX_DIGITS),
    removed: all.length - national.length,
  };
}

/** Input mask: digits only, capped at 11, formatted as (DD) 99999-9999 or (DD) 9999-9999. */
export function maskBrazilianPhone(value: string): string {
  return formatBrazilianPhone(nationalPhoneDigits(value).digits, true);
}

/**
 * onChange helper for phone inputs: returns the masked value and keeps the caret next to the
 * digit being edited, so formatting does not push it to the end of the field.
 */
export function maskPhoneChange(
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
): string {
  const input = event.currentTarget;
  const raw = input.value;
  const caret = input.selectionStart ?? raw.length;
  const masked = maskBrazilianPhone(raw);
  const digitsBeforeCaret = Math.max(
    0,
    digitsOnly(raw.slice(0, caret)).length - nationalPhoneDigits(raw).removed,
  );
  requestAnimationFrame(() => {
    let seen = 0;
    let position = masked.length;
    for (let index = 0; index < masked.length; index += 1) {
      if (seen === digitsBeforeCaret) {
        position = index;
        break;
      }
      if (/\d/.test(masked.charAt(index))) seen += 1;
    }
    input.setSelectionRange(position, position);
  });
  return masked;
}

export function normalizeUF(value: string): string {
  return value.trim().toUpperCase().slice(0, 2);
}

export const OPTIONAL_LINK_HINT = "Opcional. Pode digitar sem https://.";

/** Adds "https://" to an address typed without a scheme ("github.com/fulano"); anything else is only trimmed. */
export function withHttpsScheme(value: string): string {
  const candidate = value.trim();
  if (!candidate || /^[a-z][a-z\d+.-]*:(?!\d)/i.test(candidate)) return candidate;
  return `https://${candidate}`;
}

export function normalizeOptionalUrl(value: string): string | null {
  return withHttpsScheme(value) || null;
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

export const OBJETIVO_MAX_LENGTH = 280;

/** Professional goal is a single paragraph: no emoji and no control characters, line breaks included (the backend refuses them). */
export function sanitizeObjetivo(value: string): string {
  return stripEmoji(value).replace(/\p{Cc}+/gu, " ").slice(0, OBJETIVO_MAX_LENGTH);
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
  // Area codes run from 11 to 99. After the area code, a mobile number (11 digits) starts with
  // 9 and a landline (10 digits) starts with 2 to 5. Keep in sync with the backend rule.
  const hasValidPrefix =
    digits.length === 11 ? digits[2] === "9" : /^[2-5]$/.test(digits[2] ?? "");
  if (
    !/^\d{10,11}$/.test(digits) ||
    /^(\d)\1+$/.test(digits) ||
    Number(digits.slice(0, 2)) < 11 ||
    !hasValidPrefix
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
    if (url.protocol !== "http:" && url.protocol !== "https:")
      return "Informe uma URL começando com http:// ou https://.";
    return /^[^.\s]+(\.[^.\s]+)+$/.test(url.hostname) ? null : "Informe uma URL válida.";
  } catch {
    return "Informe uma URL válida.";
  }
}

/**
 * Validates a link typed by the user (the scheme may be missing). With `site`, the link must belong
 * to that site or one of its subdomains, e.g. { domain: "github.com", name: "GitHub" }.
 */
export function validateTypedLink(
  value: string | null | undefined,
  site?: { domain: string; name: string },
): string | null {
  const url = withHttpsScheme(value ?? "");
  const invalid = validateHttpUrl(url);
  if (invalid || !url || !site) return invalid;
  const { hostname } = new URL(url);
  return hostname === site.domain || hostname.endsWith(`.${site.domain}`)
    ? null
    : `Informe um link do ${site.name} (${site.domain}).`;
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

// Same limits as the backend (YearRange / DateYearRange): from 1900 up to 15 years ahead.
const MIN_YEAR = 1900;
const FUTURE_YEARS = 15;
const maxYear = () => new Date().getFullYear() + FUTURE_YEARS;

const MAX_WORKLOAD_HOURS = 10000;

export function validateWorkloadHours(value: number | null): string | null {
  if (value === null) return null;
  return value >= 1 && value <= MAX_WORKLOAD_HOURS
    ? null
    : "Informe uma carga horária de 1 a 10.000 horas.";
}

export function validateYear(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const candidate = String(value);
  if (!/^\d{4}$/.test(candidate)) return "Informe um ano com 4 dígitos.";
  const year = Number(candidate);
  return year >= MIN_YEAR && year <= maxYear()
    ? null
    : `Informe um ano entre ${MIN_YEAR} e ${maxYear()}.`;
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
  const invalid = validateIsoDate(
    `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
    true,
  );
  if (invalid) return invalid;
  return year >= MIN_YEAR && year <= maxYear()
    ? null
    : `Informe uma data entre ${MIN_YEAR} e ${maxYear()}.`;
}

export interface DatePeriodErrors {
  start: string | null;
  end: string | null;
}

/**
 * Validates a start and an optional end date typed as dd/mm/aaaa.
 * `endRequiredMessage` makes the end date mandatory and is shown when it is empty.
 */
export function validateDatePeriod(
  start: string,
  end: string | null,
  endRequiredMessage: string | null = null,
): DatePeriodErrors {
  const startError = start ? validateBrazilianDateInput(start) : "Informe a data de início.";
  let endError: string | null = null;
  if (end) endError = validateBrazilianDateInput(end);
  else if (endRequiredMessage) endError = endRequiredMessage;
  if (!startError && !endError && end) {
    endError = validateDateRange(parseDateInput(start), parseDateInput(end));
  }
  return { start: startError, end: endError };
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
  label = "um valor válido",
): string | null {
  const text = normalizeWhitespace(value);
  if (
    text.length < min ||
    text.length > max ||
    hasForbiddenText(text) ||
    !/[\p{L}\p{N}]/u.test(text)
  ) {
    return `Informe ${label}.`;
  }
  return null;
}

export const validateCompanyName = (value: string) =>
  validateMeaningfulText(value, 2, 150, "uma empresa válida");
export const validateJobTitle = (value: string) =>
  validateMeaningfulText(value, 2, 150, "um cargo válido");
export const validateInstitutionName = (value: string) =>
  validateMeaningfulText(value, 2, 200, "uma instituição válida");
export const validateCourseName = (value: string) =>
  validateMeaningfulText(value, 2, 200, "um curso válido");
export const validateProjectName = (value: string) =>
  validateMeaningfulText(value, 2, 200, "um nome de projeto válido");
const INVALID_TEXT = "Revise o texto informado.";
export const validateFreeText = (value: string, max: number) =>
  !hasForbiddenText(value) && value.length <= max ? null : INVALID_TEXT;
/** Same as validateFreeText, but paragraph breaks (Enter) are allowed, as in the backend. */
export const validateMultilineText = (value: string, max: number) =>
  !hasForbiddenText(value.replace(/[\r\n]/g, "")) && value.length <= max ? null : INVALID_TEXT;

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

// Checklist shown while the user types a new password. Keep in sync with the
// rules enforced by validatePassword below.
export const PASSWORD_RULES = [
  { id: "length", label: "Mínimo de 8 caracteres", test: (s: string) => s.length >= 8 },
  { id: "upper", label: "Uma letra maiúscula", test: (s: string) => /[A-Z]/.test(s) },
  { id: "lower", label: "Uma letra minúscula", test: (s: string) => /[a-z]/.test(s) },
  { id: "digit", label: "Um dígito", test: (s: string) => /\d/.test(s) },
] as const;

/** Longest password the API accepts. */
export const PASSWORD_MAX_LENGTH = 1024;

export function validatePassword(senha: string): string | null {
  if (senha.length < 8) return "A senha deve ter pelo menos 8 caracteres.";
  if (!/[A-Z]/.test(senha))
    return "A senha deve conter pelo menos uma letra maiúscula.";
  if (!/[a-z]/.test(senha))
    return "A senha deve conter pelo menos uma letra minúscula.";
  if (!/\d/.test(senha)) return "A senha deve conter pelo menos um dígito.";
  return null;
}
