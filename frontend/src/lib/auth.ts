import {
  apiGet,
  apiMutation,
  ensureCsrfToken,
  refreshCsrfToken,
} from "./api";
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
  // The antiforgery pair must be re-generated now that the user is authenticated.
  await refreshCsrfToken();
  return response;
}

export async function logout(): Promise<void> {
  await ensureCsrfToken();
  await apiMutation<void>("POST", "/api/auth/logout");
  // After logout the browser is anonymous again; rebind the antiforgery pair.
  await refreshCsrfToken();
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

export async function activateAccount(request: ActivateAccountRequest): Promise<void> {
  await ensureCsrfToken();
  await apiMutation<void>("POST", "/api/auth/activate-account", request);
}
