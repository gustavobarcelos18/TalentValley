// Newsletter consent of the signed-in student or recruiter (same shape for both roles).
// atualizadaEm is the date of the last opt-in or revocation; null when never opted in.
export interface NewsletterResponse {
  aceita: boolean;
  atualizadaEm: string | null;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  traceId?: string;
  errors?: Record<string, string[]>;
  /** Stable machine-readable reason, for example TERMOS_PENDENTES. */
  code?: string;
}
