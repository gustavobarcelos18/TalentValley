import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateAccount,
  changePassword,
  fetchCurrentUser,
  forgotPassword,
  login,
  logout,
  resendActivation,
  resetPassword,
} from "@/lib/auth";
import { apiGet, apiMutation, ensureCsrfToken, refreshCsrfToken } from "@/lib/api";

vi.mock("@/lib/api");

const calls: string[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  calls.length = 0;
  vi.mocked(ensureCsrfToken).mockImplementation(async () => { calls.push("ensure"); });
  vi.mocked(apiMutation).mockImplementation(async () => { calls.push("mutation"); return undefined; });
  vi.mocked(refreshCsrfToken).mockImplementation(async () => { calls.push("refresh"); });
});

describe("auth requests", () => {
  it("login ensures the token, posts and rebinds the token, returning the response", async () => {
    const response = { usuario: { id: "1" } };
    vi.mocked(apiMutation).mockImplementationOnce(async () => { calls.push("mutation"); return response; });

    await expect(login({ email: "a@b.c", senha: "x" })).resolves.toBe(response);

    expect(calls).toEqual(["ensure", "mutation", "refresh"]);
    expect(apiMutation).toHaveBeenCalledWith("POST", "/api/auth/login", { email: "a@b.c", senha: "x" });
  });

  it("logout ensures the token, posts and rebinds the token", async () => {
    await logout();

    expect(calls).toEqual(["ensure", "mutation", "refresh"]);
    expect(apiMutation).toHaveBeenCalledWith("POST", "/api/auth/logout");
  });

  it("changePassword posts and rebinds the token", async () => {
    const request = { senhaAtual: "a", novaSenha: "b" };

    await changePassword(request);

    expect(calls).toEqual(["ensure", "mutation", "refresh"]);
    expect(apiMutation).toHaveBeenCalledWith("POST", "/api/auth/change-password", request);
  });

  it("fetchCurrentUser reads the session user", async () => {
    await fetchCurrentUser();

    expect(apiGet).toHaveBeenCalledWith("/api/auth/me");
  });

  it("forgotPassword posts the email and returns the response", async () => {
    vi.mocked(apiMutation).mockResolvedValueOnce({ message: "ok" });

    await expect(forgotPassword("a@b.c")).resolves.toEqual({ message: "ok" });

    expect(apiMutation).toHaveBeenCalledWith("POST", "/api/auth/forgot-password", { email: "a@b.c" });
  });

  it.each([
    ["resetPassword", () => resetPassword({ email: "a@b.c", token: "t", novaSenha: "n" }), "/api/auth/reset-password", { email: "a@b.c", token: "t", novaSenha: "n" }],
    ["resendActivation", () => resendActivation("a@b.c"), "/api/auth/resend-activation", { email: "a@b.c" }],
    ["activateAccount", () => activateAccount({ email: "a@b.c", token: "t", senha: "s" }), "/api/auth/activate-account", { email: "a@b.c", token: "t", senha: "s" }],
  ])("%s ensures the token and posts without rebinding it", async (_name, call, path, body) => {
    await call();

    expect(calls).toEqual(["ensure", "mutation"]);
    expect(apiMutation).toHaveBeenCalledWith("POST", path, body);
  });
});
