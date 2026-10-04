import type {
  PaginatedResponse,
  RecruiterDashboard,
  TalentListItem,
  TalentSearchFilters,
} from "@/types/recruiter";
import { makeTalentListItem } from "./recruiterFixtures";

/** Search filters with every criterion empty; pass `overrides` for the criteria a test cares about. */
export function makeFilters(overrides: Partial<TalentSearchFilters> = {}): TalentSearchFilters {
  return {
    page: 1,
    nome: "",
    cidade: "",
    uf: "",
    competenciaIds: [],
    tiposFormacao: [],
    formacaoNome: "",
    statusFormacao: [],
    rpvVerificado: false,
    disponibilidades: [],
    modalidades: [],
    ordenacao: null,
    ...overrides,
  };
}

/** One page of talents; the totals default to what the given items imply. */
export function makeTalentPage(
  items: TalentListItem[],
  overrides: Partial<PaginatedResponse<TalentListItem>> = {},
): PaginatedResponse<TalentListItem> {
  return { items, page: 1, pageSize: 10, totalItems: items.length, totalPages: 1, ...overrides };
}

/** Dashboard of a recruiter that already visited before and has one recent favorite. */
export function makeDashboard(overrides: Partial<RecruiterDashboard> = {}): RecruiterDashboard {
  return {
    desdeUltimoAcesso: "2026-09-01T12:00:00Z",
    indicadores: { perfisAtualizadosDesdeUltimoAcesso: 4, novosAlunosDesdeUltimoAcesso: 7, favoritos: 2 },
    favoritosRecentes: [{ favoritadoEm: "2026-09-02T12:00:00Z", talento: makeTalentListItem() }],
    ...overrides,
  };
}
