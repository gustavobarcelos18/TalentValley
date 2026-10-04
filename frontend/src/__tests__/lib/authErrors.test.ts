import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { formatWait, getAuthErrorMessage } from "@/lib/authErrors";

describe("formatWait", () => {
  it.each([
    [1, "1 segundo"],
    [45, "45 segundos"],
    [60, "1 minuto"],
    [61, "2 minutos"],
    [300, "5 minutos"],
  ])("%i seconds -> %s", (seconds, text) => {
    expect(formatWait(seconds)).toBe(text);
  });
});

describe("getAuthErrorMessage", () => {
  const FALLBACK = "Não foi possível entrar.";
  const FORBIDDEN = "Acesso indisponível para esta conta.";
  const options = { fallback: FALLBACK };

  it("treats anything but an ApiError as a network failure", () => {
    expect(getAuthErrorMessage(new Error("x"), options)).toBe("Não foi possível conectar ao servidor. Tente novamente.");
  });

  it.each([
    [401, "Sua sessão expirou. Entre novamente."],
    [403, FORBIDDEN],
    [423, "Conta temporariamente bloqueada. Tente novamente mais tarde."],
    [500, FALLBACK],
  ])("maps status %i", (status, message) => {
    expect(getAuthErrorMessage(new ApiError(status, "english"), options)).toBe(message);
  });

  it("includes the wait when the 429 carries Retry-After", () => {
    expect(getAuthErrorMessage(new ApiError(429, "x", undefined, 90), options)).toBe("Muitas tentativas. Aguarde 2 minutos e tente novamente.");
  });

  it("uses generic copy when the 429 has no Retry-After", () => {
    expect(getAuthErrorMessage(new ApiError(429, "x"), options)).toBe("Muitas tentativas. Aguarde um instante e tente novamente.");
  });

  it("prefers a per-screen override for its status", () => {
    const overrides = { 401: "E-mail ou senha inválidos." };

    expect(getAuthErrorMessage(new ApiError(401, "x"), { ...options, overrides })).toBe("E-mail ou senha inválidos.");
    expect(getAuthErrorMessage(new ApiError(403, "x"), { ...options, overrides })).toBe(FORBIDDEN);
  });
});
