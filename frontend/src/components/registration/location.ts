import { createFilterOptions } from "@mui/material";
import { BRAZILIAN_UFS, sanitizeCityName } from "@/lib/validation";

// ---------------------------------------------------------------------------
// IBGE municipality lookup (frontend-only). Fetches the official city list for
// a Brazilian state so the Cidade field is always restricted to real options.
// The list is cached per UF to avoid redundant requests for the same state.
// ---------------------------------------------------------------------------

export type Municipio = {
  id: number;
  nome: string;
};

export const municipioCache = new Map<string, Municipio[]>();

export const municipioFilter = createFilterOptions<Municipio>({
  ignoreAccents: true,
  ignoreCase: true,
  limit: 100,
});

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function findMunicipio(municipios: Municipio[], nome: string): Municipio | null {
  const target = normalizeSearch(nome);
  return municipios.find((m) => normalizeSearch(m.nome) === target) ?? null;
}

export async function fetchMunicipios(uf: string, signal: AbortSignal): Promise<Municipio[]> {
  const response = await fetch(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
    { signal },
  );
  if (!response.ok) throw new Error("IBGE HTTP failure");
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("IBGE invalid response");

  const municipios: Municipio[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "number" ? record.id : Number(record.id);
    const nome = typeof record.nome === "string" ? record.nome.trim() : "";
    if (Number.isFinite(id) && nome) municipios.push({ id, nome });
  }
  if (municipios.length === 0) throw new Error("IBGE empty response");
  return municipios;
}

// ---------------------------------------------------------------------------
// CEP helpers (frontend-only). The CEP only autofills Cidade/UF through the
// public ViaCEP API and is never sent to the backend registration endpoints.
// ---------------------------------------------------------------------------

export const CEP_LOOKUP_ERROR =
  "Não foi possível localizar o CEP. Preencha Cidade e UF manualmente.";

export function formatCep(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function validateCep(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length !== 8) return "Informe um CEP válido com 8 dígitos.";
  return null;
}

// Maps "how many digits sit before the caret" back to a position in the
// hyphenated value, so formatting never makes the caret jump unexpectedly.
export function caretAfterDigits(formatted: string, digitsBeforeCaret: number): number {
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (seen === digitsBeforeCaret) return index;
    if (/\d/.test(formatted[index])) seen += 1;
  }
  return formatted.length;
}

// Pasted CEPs arrive in many shapes ("36700120", "36700-120", "36.700-120",
// sometimes padded with whitespace). Because the field keeps maxLength 9, the
// native paste would truncate "36.700-120" to "36.700-12" and lose the last
// digit before the formatter ever runs. The paste handler therefore rebuilds
// the value from the digits only, replacing the current selection.
export function applyCepPaste(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  clipboardText: string,
): { value: string; digitsBeforeCaret: number } | null {
  const digits = clipboardText.replace(/\D/g, "");
  if (!digits) return null;
  const merged =
    currentValue.slice(0, selectionStart) +
    digits +
    currentValue.slice(selectionEnd);
  return {
    value: formatCep(merged),
    digitsBeforeCaret: merged
      .slice(0, selectionStart + digits.length)
      .replace(/\D/g, "").length,
  };
}

interface ViaCepResult {
  cidade: string;
  uf: string;
}

export function readViaCep(data: unknown): ViaCepResult | null {
  if (typeof data !== "object" || data === null) return null;
  const record = data as Record<string, unknown>;
  if (record.erro === true) return null;
  const cidade = sanitizeCityName(String(record.localidade ?? ""));
  const uf = String(record.uf ?? "").trim().toUpperCase();
  if (!cidade || !(BRAZILIAN_UFS as readonly string[]).includes(uf)) return null;
  return { cidade, uf };
}
