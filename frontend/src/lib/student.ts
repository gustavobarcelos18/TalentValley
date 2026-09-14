import { apiGet, apiMutation, apiUpload } from "./api";
import type {
  CatalogoCompetenciaResponse,
  CatalogoIdiomaResponse,
  MeResponse,
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
