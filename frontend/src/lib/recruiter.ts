import { apiGet } from "@/lib/api";
import type { CatalogoCompetenciaResponse } from "@/types/student";
import type {
  PaginatedResponse,
  RecruiterDashboard,
  TalentListItem,
  TalentProfile,
  TalentSearchFilters,
} from "@/types/recruiter";

function appendAll(params: URLSearchParams, name: string, values: readonly (string | number)[]) {
  values.forEach((value) => params.append(name, String(value)));
}

export function talentSearchParams(filters: TalentSearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.nome) params.set("nome", filters.nome);
  if (filters.cidade) params.set("cidade", filters.cidade);
  if (filters.uf) params.set("uf", filters.uf);
  appendAll(params, "competenciaIds", filters.competenciaIds);
  appendAll(params, "tiposFormacao", filters.tiposFormacao);
  if (filters.formacaoNome) params.set("formacaoNome", filters.formacaoNome);
  appendAll(params, "statusFormacao", filters.statusFormacao);
  if (filters.rpvVerificado) params.set("rpvVerificado", "true");
  appendAll(params, "disponibilidades", filters.disponibilidades);
  appendAll(params, "modalidades", filters.modalidades);
  if (filters.ordenacao) params.set("ordenacao", filters.ordenacao.toLowerCase());
  return params;
}

export function fetchRecruiterDashboard(): Promise<RecruiterDashboard> {
  return apiGet<RecruiterDashboard>("/api/recrutador/dashboard");
}

export function fetchTalents(filters: TalentSearchFilters): Promise<PaginatedResponse<TalentListItem>> {
  const query = talentSearchParams(filters).toString();
  return apiGet<PaginatedResponse<TalentListItem>>(`/api/talentos${query ? `?${query}` : ""}`);
}

export function fetchTalent(slug: string): Promise<TalentProfile> {
  return apiGet<TalentProfile>(`/api/talentos/${encodeURIComponent(slug)}`);
}

export function fetchRecruiterCompetencies(): Promise<CatalogoCompetenciaResponse[]> {
  return apiGet<CatalogoCompetenciaResponse[]>("/api/competencias");
}
