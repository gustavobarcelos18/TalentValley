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

  if (csrfToken) {
    headers["X-XSRF-TOKEN"] = csrfToken;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
      return apiMutation<T>(method, path, body, false);
    }

    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function parseError(response: Response): Promise<ApiError> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
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
