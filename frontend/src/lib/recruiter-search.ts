import type {
  ModalidadeTrabalho,
  StatusFormacao,
  TipoDisponibilidade,
  TipoFormacao,
} from "@/types/student";
import type { TalentSearchFilters, TalentSort } from "@/types/recruiter";
import {
  AREA_INTERESSE_LABELS,
  AREA_INTERESSE_OPCOES,
  CATEGORIA_CNH_LABELS,
  CATEGORIA_CNH_OPCOES,
  DISPONIBILIDADE_LABELS,
  MODALIDADE_LABELS,
  STATUS_BUSCA_OPCOES,
  STATUS_FORMACAO_LABELS,
  TIPO_FORMACAO_LABELS,
} from "@/lib/labels";
import { STATUS_BUSCA_RECRUTADOR_LABELS } from "@/lib/talent-busca";
import { BRAZILIAN_UFS } from "@/lib/validation";

export const FORMATION_TYPES: TipoFormacao[] = ["CURSO_LIVRE", "TECNICO", "TECNOLOGO", "GRADUACAO", "POS_GRADUACAO"];
export const FORMATION_STATUSES: StatusFormacao[] = ["EM_ANDAMENTO", "CONCLUIDO", "TRANCADO"];
export const AVAILABILITIES: TipoDisponibilidade[] = ["ESTAGIO", "CLT", "PJ", "FREELANCER", "TRAINEE"];
export const MODALITIES: ModalidadeTrabalho[] = ["PRESENCIAL", "HIBRIDO", "REMOTO"];
const SORTS: TalentSort[] = ["RELEVANCIA", "RECENTES", "NOME"];

// Matching ignores case, but the canonical value is returned (area values are PascalCase).
function validValues<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T[] {
  const byUpperCase = new Map(allowed.map((item) => [item.toUpperCase(), item]));
  const found = params.getAll(key).map((value) => byUpperCase.get(value.toUpperCase()));
  return [...new Set(found.filter((value): value is T => value !== undefined))];
}

function flag(params: URLSearchParams, key: string): boolean {
  return params.get(key)?.toLowerCase() === "true";
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
    uf: (BRAZILIAN_UFS as readonly string[]).includes(uf) ? uf : "",
    competenciaIds: [...new Set(competencyIds)],
    tiposFormacao: validValues(params, "tiposFormacao", FORMATION_TYPES),
    formacaoNome: text(params, "formacaoNome"),
    statusFormacao: validValues(params, "statusFormacao", FORMATION_STATUSES),
    rpvVerificado: flag(params, "rpvVerificado"),
    disponibilidades: validValues(params, "disponibilidades", AVAILABILITIES),
    modalidades: validValues(params, "modalidades", MODALITIES),
    statusBusca: validValues(params, "statusBusca", STATUS_BUSCA_OPCOES),
    areasInteresse: validValues(params, "areasInteresse", AREA_INTERESSE_OPCOES),
    aceitaViajar: flag(params, "aceitaViajar"),
    aceitaMudarDeCidade: flag(params, "aceitaMudarDeCidade"),
    categoriasCnh: validValues(params, "categoriasCnh", CATEGORIA_CNH_OPCOES),
    interesseVagaPcd: flag(params, "interesseVagaPcd"),
    ordenacao: SORTS.includes(sortValue as TalentSort) ? sortValue as TalentSort : null,
  };
}

export function hasTalentFilters(filters: TalentSearchFilters): boolean {
  return Boolean(filters.nome || filters.cidade || filters.uf || filters.competenciaIds.length ||
    filters.tiposFormacao.length || filters.formacaoNome || filters.statusFormacao.length ||
    filters.rpvVerificado || filters.disponibilidades.length || filters.modalidades.length ||
    filters.statusBusca.length || filters.areasInteresse.length || filters.aceitaViajar ||
    filters.aceitaMudarDeCidade || filters.categoriasCnh.length || filters.interesseVagaPcd);
}

/** Readable names of the active criteria, in the order shown as chips. */
export function activeFilterLabels(filters: TalentSearchFilters, competencyName: (id: number) => string): string[] {
  return [
    filters.nome && `Nome: ${filters.nome}`,
    filters.cidade && `Cidade: ${filters.cidade}`,
    filters.uf && `UF: ${filters.uf}`,
    ...filters.competenciaIds.map(competencyName),
    ...filters.tiposFormacao.map((item) => TIPO_FORMACAO_LABELS[item]),
    filters.formacaoNome && `Formação: ${filters.formacaoNome}`,
    ...filters.statusFormacao.map((item) => STATUS_FORMACAO_LABELS[item]),
    filters.rpvVerificado && "RPV verificado",
    ...filters.disponibilidades.map((item) => DISPONIBILIDADE_LABELS[item]),
    ...filters.modalidades.map((item) => MODALIDADE_LABELS[item]),
    ...filters.statusBusca.map((item) => STATUS_BUSCA_RECRUTADOR_LABELS[item]),
    ...filters.areasInteresse.map((item) => AREA_INTERESSE_LABELS[item]),
    filters.aceitaViajar && "Aceita viajar a trabalho",
    filters.aceitaMudarDeCidade && "Aceita mudar de cidade",
    ...filters.categoriasCnh.map((item) => `CNH ${CATEGORIA_CNH_LABELS[item]}`),
    filters.interesseVagaPcd && "Interesse em vaga PCD",
  ].filter((label): label is string => Boolean(label));
}
