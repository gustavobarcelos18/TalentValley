import { ApiError } from "@/lib/api";

interface AuthErrorOptions {
  /** Message for statuses without a specific mapping (never the backend text). */
  fallback: string;
  /** Per-screen wording for a status, e.g. 401 on login means wrong credentials. */
  overrides?: Partial<Record<number, string>>;
}

const NETWORK_ERROR = "Não foi possível conectar ao servidor. Tente novamente.";

/** "1 minuto", "45 segundos": the wait asked by a 429 `Retry-After`, in text. */
export function formatWait(seconds: number): string {
  if (seconds < 60) {
    return seconds === 1 ? "1 segundo" : `${seconds} segundos`;
  }
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}

function tooManyAttempts(retryAfterSeconds?: number): string {
  return retryAfterSeconds
    ? `Muitas tentativas. Aguarde ${formatWait(retryAfterSeconds)} e tente novamente.`
    : "Muitas tentativas. Aguarde um instante e tente novamente.";
}

// Maps an authentication request failure to pt-BR copy by HTTP status. The
// backend ProblemDetails titles are English and are intentionally not shown.
export function getAuthErrorMessage(
  error: unknown,
  { fallback, overrides }: AuthErrorOptions
): string {
  if (!(error instanceof ApiError)) {
    return NETWORK_ERROR;
  }

  const override = overrides?.[error.status];
  if (override) return override;

  switch (error.status) {
    case 401:
      return "Sua sessão expirou. Entre novamente.";
    case 403:
      return "Acesso indisponível para esta conta.";
    case 423:
      return "Conta temporariamente bloqueada. Tente novamente mais tarde.";
    case 429:
      return tooManyAttempts(error.retryAfterSeconds);
    default:
      return fallback;
  }
}
