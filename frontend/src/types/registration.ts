import type { TipoFormacao } from "@/types/student";

export type RegistrationRequestType = "ALUNO" | "RECRUTADOR";
export type RegistrationRequestStatus = "PENDENTE" | "APROVADA" | "REJEITADA";

export interface RegistrationCreated { id: string; status: RegistrationRequestStatus; }
export interface StudentRegistrationRequest {
  nomeCompleto: string; email: string; telefone: string; cidade: string; uf: string;
  instituicaoEnsino: string; curso: string; tipoFormacao: TipoFormacao;
  anoConclusaoPrevisto?: number | null; relacaoRioPombaValley?: string | null;
}
export interface RecruiterRegistrationRequest {
  nomeCompleto: string; email: string; empresa: string; cargo: string; telefone: string;
  cidade: string; uf: string; siteEmpresa?: string | null;
}


