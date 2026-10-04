import { StrictMode, type ReactNode } from "react";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, refreshCsrfToken, setUnauthorizedHandler } from "@/lib/api";
import { fetchCurrentUser, logout as apiLogout } from "@/lib/auth";
import type { UsuarioAutenticado } from "@/types/auth";

const router = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/auth");
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  refreshCsrfToken: vi.fn(),
  setUnauthorizedHandler: vi.fn(),
}));

const ANA: UsuarioAutenticado = { id: "1", nome: "Ana", email: "ana@example.com", role: "ALUNO" };
const BIA: UsuarioAutenticado = { id: "2", nome: "Bia", email: "bia@example.com", role: "RECRUTADOR" };
const SESSION_ERROR = "Não foi possível verificar sua sessão. Tente novamente.";
const EXPIRED_LOGIN = "/login?sessao=expirada";

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

function LoadingProbe() {
  const { loading } = useAuth();
  return <p>{loading ? "carregando" : "pronto"}</p>;
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function renderSettled() {
  const hook = renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

// The handler the provider registered last and has not removed since.
function registeredHandler() {
  const calls = vi.mocked(setUnauthorizedHandler).mock.calls;
  const handler = calls.at(-1)?.[0];
  if (!handler) throw new Error("no unauthorized handler is registered");
  return handler;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(refreshCsrfToken).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial session check", () => {
    it("starts loading with no user and no error", () => {
      vi.mocked(fetchCurrentUser).mockReturnValue(new Promise(() => undefined));

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.loading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it("keeps loading until the check answers, then exposes the user", async () => {
      const pending = deferred<UsuarioAutenticado>();
      vi.mocked(fetchCurrentUser).mockReturnValue(pending.promise);
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.loading).toBe(true);

      await act(async () => pending.resolve(ANA));

      expect(result.current).toMatchObject({ user: ANA, loading: false, error: null });
    });

    it("runs the check only once, even under StrictMode double effects", async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValue(ANA);

      render(
        <StrictMode>
          <AuthProvider>
            <LoadingProbe />
          </AuthProvider>
        </StrictMode>,
      );
      await screen.findByText("pronto");

      expect(fetchCurrentUser).toHaveBeenCalledTimes(1);
    });

    it.each([401, 403])("treats a %i as an anonymous visitor, not as an error", async (status) => {
      vi.mocked(fetchCurrentUser).mockRejectedValue(new ApiError(status, "negado"));

      const { result } = await renderSettled();

      expect(result.current).toMatchObject({ user: null, loading: false, error: null });
    });

    it.each<{ name: string; failure: Error }>([
      { name: "a server failure", failure: new ApiError(500, "falhou") },
      { name: "a rate limit", failure: new ApiError(429, "muitas tentativas") },
      { name: "a network failure", failure: new TypeError("Failed to fetch") },
    ])("reports $name as an operational error without confirming a session", async ({ failure }) => {
      vi.mocked(fetchCurrentUser).mockRejectedValue(failure);

      const { result } = await renderSettled();

      expect(result.current).toMatchObject({ user: null, loading: false, error: SESSION_ERROR });
    });
  });

  describe("loginCompleted", () => {
    it("stores the signed-in user and clears any previous error", async () => {
      vi.mocked(fetchCurrentUser).mockRejectedValue(new ApiError(500, "falhou"));
      const { result } = await renderSettled();
      expect(result.current.error).toBe(SESSION_ERROR);

      act(() => result.current.loginCompleted(ANA));

      expect(result.current).toMatchObject({ user: ANA, loading: false, error: null });
    });
  });

  describe("refreshUser", () => {
    it("replaces the user with the one the server returns", async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValueOnce(ANA).mockResolvedValueOnce(BIA);
      const { result } = await renderSettled();

      await act(() => result.current.refreshUser());

      expect(result.current.user).toEqual(BIA);
      expect(fetchCurrentUser).toHaveBeenCalledTimes(2);
    });

    it("recovers from a previous error when the check succeeds", async () => {
      vi.mocked(fetchCurrentUser).mockRejectedValueOnce(new ApiError(503, "indisponível")).mockResolvedValueOnce(ANA);
      const { result } = await renderSettled();
      expect(result.current.error).toBe(SESSION_ERROR);

      await act(() => result.current.refreshUser());

      expect(result.current).toMatchObject({ user: ANA, error: null });
    });

    it("signs the user out when the session is gone (401)", async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValueOnce(ANA).mockRejectedValueOnce(new ApiError(401, "expirou"));
      const { result } = await renderSettled();
      expect(result.current.user).toEqual(ANA);

      await act(() => result.current.refreshUser());

      expect(result.current).toMatchObject({ user: null, error: null });
    });

    it("never mistakes an operational failure for a logout", async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValueOnce(ANA).mockRejectedValueOnce(new ApiError(500, "falhou"));
      const { result } = await renderSettled();

      await act(() => result.current.refreshUser());

      expect(result.current).toMatchObject({ user: ANA, loading: false, error: SESSION_ERROR });
    });
  });

  describe("clearError", () => {
    it("clears the error and keeps the rest of the state", async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValueOnce(ANA).mockRejectedValueOnce(new Error("rede"));
      const { result } = await renderSettled();
      await act(() => result.current.refreshUser());
      expect(result.current.error).toBe(SESSION_ERROR);

      act(() => result.current.clearError());

      expect(result.current).toMatchObject({ user: ANA, loading: false, error: null });
    });
  });

  describe("logout", () => {
    it("calls the API and clears the user", async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValue(ANA);
      vi.mocked(apiLogout).mockResolvedValue(undefined);
      const { result } = await renderSettled();
      expect(result.current.user).toEqual(ANA);

      await act(() => result.current.logout());

      expect(apiLogout).toHaveBeenCalledTimes(1);
      expect(result.current).toMatchObject({ user: null, loading: false, error: null });
    });

    it("clears the local user even when the API call fails, and surfaces the failure", async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValue(ANA);
      vi.mocked(apiLogout).mockRejectedValue(new Error("sem rede"));
      const { result } = await renderSettled();

      let failure: unknown = null;
      await act(async () => {
        failure = await result.current.logout().then(
          () => null,
          (error: unknown) => error,
        );
      });

      expect(failure).toEqual(new Error("sem rede"));
      expect(result.current.user).toBeNull();
    });
  });

  describe("expired session handling", () => {
    it("registers a handler on mount and removes it on unmount", async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValue(ANA);
      const { unmount } = await renderSettled();
      expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(expect.any(Function));

      unmount();

      expect(setUnauthorizedHandler).toHaveBeenLastCalledWith(null);
    });

    it("ends the local login, refreshes the CSRF token and sends a signed-in user to the login", async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValue(ANA);
      const { result } = await renderSettled();

      act(() => registeredHandler()());

      expect(result.current).toMatchObject({ user: null, loading: false, error: null });
      expect(refreshCsrfToken).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith(EXPIRED_LOGIN);
    });

    it("handles a session that was opened by loginCompleted", async () => {
      vi.mocked(fetchCurrentUser).mockRejectedValue(new ApiError(401, "anônimo"));
      const { result } = await renderSettled();
      act(() => result.current.loginCompleted(BIA));

      act(() => registeredHandler()());

      expect(result.current.user).toBeNull();
      expect(router.replace).toHaveBeenCalledWith(EXPIRED_LOGIN);
    });

    it("ignores a 401 for an anonymous visitor", async () => {
      vi.mocked(fetchCurrentUser).mockRejectedValue(new ApiError(401, "anônimo"));
      await renderSettled();

      act(() => registeredHandler()());

      expect(router.replace).not.toHaveBeenCalled();
      expect(refreshCsrfToken).not.toHaveBeenCalled();
    });

    it("ends the session only once when several requests answer 401", async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValue(ANA);
      await renderSettled();
      const handler = registeredHandler();

      act(() => {
        handler();
        handler();
      });

      expect(router.replace).toHaveBeenCalledTimes(1);
      expect(refreshCsrfToken).toHaveBeenCalledTimes(1);
    });

    it("ignores a 401 after the user logged out", async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValue(ANA);
      vi.mocked(apiLogout).mockResolvedValue(undefined);
      const { result } = await renderSettled();
      await act(() => result.current.logout());

      act(() => registeredHandler()());

      expect(router.replace).not.toHaveBeenCalled();
    });
  });

  describe("context value", () => {
    it("keeps the same value while the state does not change", async () => {
      vi.mocked(fetchCurrentUser).mockResolvedValue(ANA);
      const { result, rerender } = await renderSettled();
      const before = result.current;

      rerender();

      expect(result.current).toBe(before);
    });
  });

  describe("browser storage", () => {
    it("never reads or writes web storage during the whole session flow", async () => {
      const getItem = vi.spyOn(Storage.prototype, "getItem");
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      vi.mocked(fetchCurrentUser).mockResolvedValue(ANA);
      vi.mocked(apiLogout).mockResolvedValue(undefined);
      const { result } = await renderSettled();

      act(() => result.current.loginCompleted(BIA));
      await act(() => result.current.logout());

      expect(getItem).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();
    });
  });
});
