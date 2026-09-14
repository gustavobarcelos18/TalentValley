import type {
  ModalidadeTrabalho,
  StatusFormacao,
  TipoDisponibilidade,
  TipoFormacao,
} from "@/types/student";
import type { TalentSearchFilters, TalentSort } from "@/types/recruiter";

export const FORMATION_TYPES: TipoFormacao[] = ["CURSO_LIVRE", "TECNICO", "TECNOLOGO", "GRADUACAO", "POS_GRADUACAO"];
export const FORMATION_STATUSES: StatusFormacao[] = ["EM_ANDAMENTO", "CONCLUIDO", "TRANCADO"];
export const AVAILABILITIES: TipoDisponibilidade[] = ["ESTAGIO", "CLT", "PJ", "FREELANCER", "TRAINEE"];
export const MODALITIES: ModalidadeTrabalho[] = ["PRESENCIAL", "HIBRIDO", "REMOTO"];
const SORTS: TalentSort[] = ["RELEVANCIA", "RECENTES", "NOME"];

function validValues<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T[] {
  const set = new Set(allowed);
  return [...new Set(params.getAll(key).map((value) => value.toUpperCase()).filter((value): value is T => set.has(value as T)))];
}

function text(params: URLSearchParams, key: string): string {
  return (params.get(key) ?? "").trim();
}

export function parseTalentSearch(params: URLSearchParams): TalentSearchFilters {
  const rawPage = Number.parseInt(params.get("page") ?? "1", 10);
  const uf = text(params, "uf").toUpperCase();
  const sortValue = text(params, "ordenacao").toUpperCase();
  const competencyIds = params.getAll("competenciaIds")
    .map((value) => Number(value))
    .filter((value) => Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647);

  return {
    page: Number.isSafeInteger(rawPage) && rawPage > 0 && rawPage <= 214_748_364 ? rawPage : 1,
    nome: text(params, "nome"),
    cidade: text(params, "cidade"),
    uf: /^[A-Z]{2}$/.test(uf) ? uf : "",
    competenciaIds: [...new Set(competencyIds)],
    tiposFormacao: validValues(params, "tiposFormacao", FORMATION_TYPES),
    formacaoNome: text(params, "formacaoNome"),
    statusFormacao: validValues(params, "statusFormacao", FORMATION_STATUSES),
    rpvVerificado: params.get("rpvVerificado")?.toLowerCase() === "true",
    disponibilidades: validValues(params, "disponibilidades", AVAILABILITIES),
    modalidades: validValues(params, "modalidades", MODALITIES),
    ordenacao: SORTS.includes(sortValue as TalentSort) ? sortValue as TalentSort : null,
  };
}

export function hasTalentFilters(filters: TalentSearchFilters): boolean {
  return Boolean(filters.nome || filters.cidade || filters.uf || filters.competenciaIds.length ||
    filters.tiposFormacao.length || filters.formacaoNome || filters.statusFormacao.length ||
    filters.rpvVerificado || filters.disponibilidades.length || filters.modalidades.length);
}
