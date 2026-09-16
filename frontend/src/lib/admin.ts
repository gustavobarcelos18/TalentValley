import { apiGet, apiMutation } from "@/lib/api";
import type { AdminDashboard, AdminRecruiter, AdminRecruiterDetail, AdminStudentDetail, AdminStudentListItem, AdminRegistrationRequest, AdminRegistrationRequestDetail, AuditItem, PaginatedResponse, RegistrationRequestStatus, RegistrationRequestType, RpvValidation, RpvValidationDetail } from "@/types/admin";
import type { RecruiterRegistrationRequest, RegistrationCreated, StudentRegistrationRequest } from "@/types/registration";

const query = (values: Record<string, string | number | undefined>) => { const p = new URLSearchParams(); Object.entries(values).forEach(([k, v]) => { if (v !== undefined && v !== "" && v !== 1) p.set(k, String(v)); }); const result = p.toString(); return result ? `?${result}` : ""; };
export const adminApi = {
  dashboard: () => apiGet<AdminDashboard>("/api/admin/dashboard"),
  registrationRequests: (page: number, search: string, tipo: RegistrationRequestType | "", status: RegistrationRequestStatus | "") => apiGet<PaginatedResponse<AdminRegistrationRequest>>(`/api/admin/solicitacoes-cadastro${query({ page, search, tipo, status })}`),
  registrationRequest: (id: string) => apiGet<AdminRegistrationRequestDetail>(`/api/admin/solicitacoes-cadastro/${id}`),
  approveRegistration: (id: string) => apiMutation<void>("POST", `/api/admin/solicitacoes-cadastro/${id}/aprovar`),
  rejectRegistration: (id: string, motivo?: string) => apiMutation<void>("POST", `/api/admin/solicitacoes-cadastro/${id}/rejeitar`, motivo ? { motivo } : {}),
  students: (page: number, search: string) => apiGet<PaginatedResponse<AdminStudentListItem>>(`/api/admin/alunos${query({ page, search })}`),
  student: (id: string) => apiGet<AdminStudentDetail>(`/api/admin/alunos/${id}`),
  createStudent: (body: { nomeCompleto: string; email: string }) => apiMutation("POST", "/api/admin/alunos", body),
  studentAction: (id: string, action: "bloquear" | "reativar") => apiMutation<void>("POST", `/api/admin/alunos/${id}/${action}`),
  deleteStudent: (id: string) => apiMutation<void>("DELETE", `/api/admin/alunos/${id}`),
  recruiters: (page: number, search: string, status: string) => apiGet<PaginatedResponse<AdminRecruiter>>(`/api/admin/recrutadores${query({ page, search, status })}`),
  recruiter: (id: string) => apiGet<AdminRecruiterDetail>(`/api/admin/recrutadores/${id}`),
  createRecruiter: (body: Record<string, string>) => apiMutation("POST", "/api/admin/recrutadores", body),
  recruiterAction: (id: string, action: "bloquear" | "reativar") => apiMutation<void>("POST", `/api/admin/recrutadores/${id}/${action}`),
  deleteRecruiter: (id: string) => apiMutation<void>("DELETE", `/api/admin/recrutadores/${id}`),
  validations: (page: number) => apiGet<PaginatedResponse<RpvValidation>>(`/api/admin/validacoes-rpv?page=${page}`),
  validation: (id: string) => apiGet<RpvValidationDetail>(`/api/admin/validacoes-rpv/${id}`),
  validationAction: (id: string, action: "aprovar" | "rejeitar" | "remover-validacao") => apiMutation<void>("POST", `/api/admin/validacoes-rpv/${id}/${action}`),
  audit: (page: number) => apiGet<PaginatedResponse<AuditItem>>(`/api/admin/auditoria?page=${page}`),
};

export const registrationApi = {
  student: (body: StudentRegistrationRequest) => apiMutation<RegistrationCreated>("POST", "/api/cadastro/aluno", body),
  recruiter: (body: RecruiterRegistrationRequest) => apiMutation<RegistrationCreated>("POST", "/api/cadastro/recrutador", body),
};
