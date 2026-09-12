export type UserRole = "ALUNO" | "RECRUTADOR" | "ADMIN";

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  role: UserRole;
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
