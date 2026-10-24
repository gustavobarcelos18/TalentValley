import {
  apiGet,
  apiMutation,
  ensureCsrfToken,
  refreshCsrfToken,
} from "./api";
import { clearProtectedFiles } from "./protectedFileCache";
import type {
  ForgotPasswordResponse,
  LoginResponse,
  UsuarioAutenticado,
} from "@/types/auth";

export interface LoginRequest {
  email: string;
  senha: string;
}

export interface ActivateAccountRequest {
  email: string;
  token: string;
  senha: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  novaSenha: string;
}

export async function login(request: LoginRequest): Promise<LoginResponse> {
  await ensureCsrfToken();
  const response = await apiMutation<LoginResponse>("POST", "/api/auth/login", request);
  clearProtectedFiles();
  // The antiforgery pair must be re-generated now that the user is authenticated.
  await refreshCsrfToken();
  return response;
}

export async function logout(): Promise<void> {
  await ensureCsrfToken();
  await apiMutation<void>("POST", "/api/auth/logout");
  clearProtectedFiles();
  // After logout the browser is anonymous again; rebind the antiforgery pair.
  await refreshCsrfToken();
}

export type DemoRole = "ALUNO" | "RECRUTADOR";

// The administrator views the site as the fictitious student or recruiter account.
export async function enterDemo(papel: DemoRole): Promise<LoginResponse> {
  await ensureCsrfToken();
  const response = await apiMutation<LoginResponse>("POST", "/api/admin/demo/entrar", { papel });
  clearProtectedFiles();
  // The session cookie changed; rebind the antiforgery pair like after login.
  await refreshCsrfToken();
  return response;
}

// Leaves the demonstration account and signs the administrator back in.
export async function leaveDemo(): Promise<LoginResponse> {
  await ensureCsrfToken();
  const response = await apiMutation<LoginResponse>("POST", "/api/demo/voltar");
  clearProtectedFiles();
  await refreshCsrfToken();
  return response;
}

export async function fetchCurrentUser(): Promise<UsuarioAutenticado> {
  return apiGet<UsuarioAutenticado>("/api/auth/me");
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResponse> {
  await ensureCsrfToken();
  return apiMutation<ForgotPasswordResponse>("POST", "/api/auth/forgot-password", {
    email,
  });
}

export async function resetPassword(request: ResetPasswordRequest): Promise<void> {
  await ensureCsrfToken();
  await apiMutation<void>("POST", "/api/auth/reset-password", request);
}

export async function resendActivation(email: string): Promise<void> {
  await ensureCsrfToken();
  await apiMutation<void>("POST", "/api/auth/resend-activation", { email });
}

export interface ChangePasswordRequest {
  senhaAtual: string;
  novaSenha: string;
}

export async function changePassword(request: ChangePasswordRequest): Promise<void> {
  await ensureCsrfToken();
  // 204: the backend reissues the session cookie, so the user stays signed in.
  await apiMutation<void>("POST", "/api/auth/change-password", request);
  // The session cookie changed; rebind the antiforgery pair like after login.
  await refreshCsrfToken();
}

// Records acceptance of the current terms version for the signed-in student or recruiter (204, no body).
export async function acceptTerms(): Promise<void> {
  await ensureCsrfToken();
  await apiMutation<void>("POST", "/api/auth/aceitar-termos");
}

export async function activateAccount(request: ActivateAccountRequest): Promise<void> {
  await ensureCsrfToken();
  await apiMutation<void>("POST", "/api/auth/activate-account", request);
}
