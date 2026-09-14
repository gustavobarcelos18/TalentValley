import type { ProblemDetails } from "@/types";
import type { CsrfResponse } from "@/types/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

let csrfToken: string | null = null;

export function getCsrfToken(): string | null {
  return csrfToken;
}

export async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/auth/csrf`, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter token de segurança (${response.status})`);
  }

  const data = (await response.json()) as CsrfResponse;
  csrfToken = data.token;
  return csrfToken;
}

export class ApiError extends Error {
  status: number;
  problem?: ProblemDetails;

  constructor(status: number, message: string, problem?: ProblemDetails) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiMutation<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
  allowAntiforgeryRetry = true
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return sendMutation<T>(method, path, {
    headers: withCsrfHeader(headers),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }, allowAntiforgeryRetry);
}

// Multipart mutation helper (file uploads). The browser must build the multipart
// boundary itself, so no Content-Type header is set here. CSRF semantics are the
// same as JSON mutations: header token, credentials included, one retry when the
// antiforgery pair is stale.
export async function apiUpload<T = void>(
  path: string,
  formData: FormData,
  allowAntiforgeryRetry = true
): Promise<T> {
  return sendMutation<T>("POST", path, {
    headers: withCsrfHeader({ Accept: "application/json" }),
    body: formData,
  }, allowAntiforgeryRetry);
}

// Downloads a protected file (photo, curriculum) with credentials and returns its
// bytes so the caller can render or hand it off through an object URL.
export async function apiDownload(path: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      Accept: "application/octet-stream, application/pdf, image/*",
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return response.blob();
}

function withCsrfHeader(headers: Record<string, string>): Record<string, string> {
  const requestHeaders = { ...headers };
  if (csrfToken) {
    requestHeaders["X-XSRF-TOKEN"] = csrfToken;
  }
  return requestHeaders;
}

async function sendMutation<T>(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  init: RequestInit,
  allowAntiforgeryRetry: boolean
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    ...init,
    // Build this immediately before every attempt. A retry has a new token.
    headers: withCsrfHeader({ ...(init.headers as Record<string, string>) }),
  });

  if (!response.ok) {
    const error = await parseError(response);

    // A stale antiforgery pair fails before the controller runs, so the
    // request was not executed and retrying with a fresh token is safe.
    if (
      allowAntiforgeryRetry &&
      error.status === 400 &&
      error.problem?.title === "Invalid antiforgery token."
    ) {
      await fetchCsrfToken();
      return sendMutation<T>(method, path, init, false);
    }

    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

// Friendly error text: prefer the backend ProblemDetails title, otherwise the
// caller-provided fallback message.
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.problem?.title ?? error.message ?? fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

async function parseError(response: Response): Promise<ApiError> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("json")) {
    try {
      const problem = (await response.json()) as ProblemDetails;
      const message = problem.title ?? `Erro na requisição (${response.status})`;
      return new ApiError(response.status, message, problem);
    } catch {
      return new ApiError(response.status, `Erro na requisição (${response.status})`);
    }
  }

  return new ApiError(response.status, `Erro na requisição (${response.status})`);
}

export async function ensureCsrfToken(): Promise<void> {
  if (!csrfToken) {
    await fetchCsrfToken();
  }
}

// The antiforgery pair is bound to the authenticated user at generation time.
// After login or logout the binding changes, so the pair must be re-obtained.
// Best effort: if the rebind fails, mutations retry once on antiforgery failure.
export async function refreshCsrfToken(): Promise<void> {
  try {
    await fetchCsrfToken();
  } catch {
    // Keep the previous token; apiMutation retries once on antiforgery failure.
  }
}
