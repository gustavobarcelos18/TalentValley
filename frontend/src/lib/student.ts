import { apiGet, apiMutation, apiUpload } from "./api";
import type {
  CatalogoCompetenciaResponse,
  CatalogoIdiomaResponse,
  MeResponse,
  ExperienciaRequest,
  ExperienciaResponse,
  FormacaoRequest,
  FormacaoResponse,
  ProjetoRequest,
  ProjetoResponse,
  TrajetoriaItemResponse,
  UpdateCompetenciasRequest,
  UpdateContatoRequest,
  UpdateDadosBasicosRequest,
  UpdateDisponibilidadeRequest,
  UpdateIdiomasRequest,
  UpdateSobreRequest,
} from "@/types/student";

// Student profile API. Endpoints and field names mirror the backend
// AlunosController/AlunoDtos exactly; do not reshape contracts here.

export function fetchMyProfile(): Promise<MeResponse> {
  return apiGet<MeResponse>("/api/alunos/me");
}

export function updateDadosBasicos(request: UpdateDadosBasicosRequest): Promise<void> {
  return apiMutation<void>("PUT", "/api/alunos/me/dados-basicos", request);
}

export function updateSobre(request: UpdateSobreRequest): Promise<void> {
  return apiMutation<void>("PUT", "/api/alunos/me/sobre", request);
}

export function updateContato(request: UpdateContatoRequest): Promise<void> {
  return apiMutation<void>("PUT", "/api/alunos/me/contato", request);
}

export function updateCompetencias(request: UpdateCompetenciasRequest): Promise<void> {
  return apiMutation<void>("PUT", "/api/alunos/me/competencias", request);
}

export function updateIdiomas(request: UpdateIdiomasRequest): Promise<void> {
  return apiMutation<void>("PUT", "/api/alunos/me/idiomas", request);
}

export function updateDisponibilidade(request: UpdateDisponibilidadeRequest): Promise<void> {
  return apiMutation<void>("PUT", "/api/alunos/me/disponibilidade", request);
}

export function fetchCompetenciaCatalog(): Promise<CatalogoCompetenciaResponse[]> {
  return apiGet<CatalogoCompetenciaResponse[]>("/api/competencias");
}

export function fetchIdiomaCatalog(): Promise<CatalogoIdiomaResponse[]> {
  return apiGet<CatalogoIdiomaResponse[]>("/api/idiomas");
}

export function uploadStudentPhoto(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<void>("/api/alunos/me/foto", formData);
}

export function deleteStudentPhoto(): Promise<void> {
  return apiMutation<void>("DELETE", "/api/alunos/me/foto");
}

export function uploadStudentCurriculum(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<void>("/api/alunos/me/curriculo", formData);
}

export function deleteStudentCurriculum(): Promise<void> {
  return apiMutation<void>("DELETE", "/api/alunos/me/curriculo");
}

export function fetchTrajectory(): Promise<TrajetoriaItemResponse[]> {
  return apiGet<TrajetoriaItemResponse[]>("/api/alunos/me/trajetoria");
}

export function fetchFormacoes(): Promise<FormacaoResponse[]> {
  return apiGet<FormacaoResponse[]>("/api/alunos/me/formacoes");
}

export function createFormacao(request: FormacaoRequest): Promise<FormacaoResponse> {
  return apiMutation<FormacaoResponse>("POST", "/api/alunos/me/formacoes", request);
}

export function updateFormacao(id: string, request: FormacaoRequest): Promise<FormacaoResponse> {
  return apiMutation<FormacaoResponse>("PUT", `/api/alunos/me/formacoes/${id}`, request);
}

export function deleteFormacao(id: string): Promise<void> {
  return apiMutation<void>("DELETE", `/api/alunos/me/formacoes/${id}`);
}

export function uploadFormationCertificate(id: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<void>(`/api/alunos/me/formacoes/${id}/certificado`, formData);
}

export function deleteFormationCertificate(id: string): Promise<void> {
  return apiMutation<void>("DELETE", `/api/alunos/me/formacoes/${id}/certificado`);
}

export function fetchExperiencias(): Promise<ExperienciaResponse[]> {
  return apiGet<ExperienciaResponse[]>("/api/alunos/me/experiencias");
}

export function createExperiencia(request: ExperienciaRequest): Promise<ExperienciaResponse> {
  return apiMutation<ExperienciaResponse>("POST", "/api/alunos/me/experiencias", request);
}

export function updateExperiencia(id: string, request: ExperienciaRequest): Promise<ExperienciaResponse> {
  return apiMutation<ExperienciaResponse>("PUT", `/api/alunos/me/experiencias/${id}`, request);
}

export function deleteExperiencia(id: string): Promise<void> {
  return apiMutation<void>("DELETE", `/api/alunos/me/experiencias/${id}`);
}

export function fetchProjetos(): Promise<ProjetoResponse[]> {
  return apiGet<ProjetoResponse[]>("/api/alunos/me/projetos");
}

export function createProjeto(request: ProjetoRequest): Promise<ProjetoResponse> {
  return apiMutation<ProjetoResponse>("POST", "/api/alunos/me/projetos", request);
}

export function updateProjeto(id: string, request: ProjetoRequest): Promise<ProjetoResponse> {
  return apiMutation<ProjetoResponse>("PUT", `/api/alunos/me/projetos/${id}`, request);
}

export function deleteProjeto(id: string): Promise<void> {
  return apiMutation<void>("DELETE", `/api/alunos/me/projetos/${id}`);
}
