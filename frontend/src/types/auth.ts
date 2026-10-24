export type UserRole = "ALUNO" | "RECRUTADOR" | "ADMIN";

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
  // True while the account has not accepted the current terms version (always false for ADMIN).
  termosPendentes: boolean;
  // True while an administrator is viewing the site as a fictitious demonstration account.
  modoDemonstracao: boolean;
}

export interface CsrfResponse {
  token: string;
}

export interface LoginResponse {
  usuario: UsuarioAutenticado;
  destinoInicial: string;
}

export interface ForgotPasswordResponse {
  mensagem: string;
}
