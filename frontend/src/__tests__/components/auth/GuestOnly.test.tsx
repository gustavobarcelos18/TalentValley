import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GuestOnly } from "@/components/auth/GuestOnly";
import type { UserRole } from "@/types/auth";
import { buildAuth, userWith, type AuthMock } from "./authMock";

const mocks = vi.hoisted(() => ({
  auth: null as unknown as AuthMock,
  router: { replace: vi.fn() },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));

const FORM = "formulário de login";
const ERROR_MESSAGE = "Não foi possível verificar sua sessão. Tente novamente.";

function setAuth(partial: Partial<AuthMock>) {
  mocks.auth = buildAuth(partial);
}

function renderGuest() {
  return render(
    <GuestOnly>
      <p>{FORM}</p>
    </GuestOnly>,
  );
}

function form() {
  return screen.queryByText(FORM);
}

describe("GuestOnly", () => {
  beforeEach(() => {
    mocks.router.replace.mockReset();
    setAuth({});
  });

  it("renders the guest content to an anonymous visitor, without redirecting", () => {
    renderGuest();

    expect(form()).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  describe("while the session is being checked", () => {
    it("shows a polite status and hides the guest content", () => {
      setAuth({ loading: true });
      renderGuest();

      const status = screen.getByRole("status");
      expect(status.getAttribute("aria-live")).toBe("polite");
      expect(status.textContent).toBe("Verificando acesso...");
      expect(form()).toBeNull();
    });

    it("does not redirect yet, even if a user is already known", () => {
      setAuth({ loading: true, user: userWith("ADMIN") });
      renderGuest();

      expect(mocks.router.replace).not.toHaveBeenCalled();
      expect(form()).toBeNull();
    });
  });

  describe("when a user is already signed in", () => {
    it("shows the redirecting status and hides the guest content", () => {
      setAuth({ user: userWith("ALUNO") });
      renderGuest();

      expect(screen.getByRole("status").textContent).toBe("Redirecionando...");
      expect(form()).toBeNull();
    });

    it.each<[UserRole, string]>([
      ["ALUNO", "/meu-perfil"],
      ["RECRUTADOR", "/recrutador"],
      ["ADMIN", "/admin"],
    ])("sends a %s to %s", (role, destination) => {
      setAuth({ user: userWith(role) });
      renderGuest();

      expect(mocks.router.replace).toHaveBeenCalledTimes(1);
      expect(mocks.router.replace).toHaveBeenCalledWith(destination);
    });

    it("still redirects when the last check also reported an error", () => {
      setAuth({ user: userWith("ADMIN"), error: ERROR_MESSAGE });
      renderGuest();

      expect(mocks.router.replace).toHaveBeenCalledWith("/admin");
      expect(form()).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("when the session check failed operationally", () => {
    it("shows the error instead of the guest content, without redirecting", () => {
      setAuth({ error: ERROR_MESSAGE });
      renderGuest();

      expect(screen.getByRole("alert").textContent).toBe(ERROR_MESSAGE);
      expect(form()).toBeNull();
      expect(mocks.router.replace).not.toHaveBeenCalled();
    });

    it("retries the check from the error", async () => {
      const user = userEvent.setup();
      setAuth({ error: ERROR_MESSAGE });
      renderGuest();

      await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

      expect(mocks.auth.refreshUser).toHaveBeenCalledTimes(1);
    });
  });

  it("redirects once the check finds a signed-in user", () => {
    setAuth({ loading: true });
    const { rerender } = renderGuest();
    expect(mocks.router.replace).not.toHaveBeenCalled();

    setAuth({ user: userWith("RECRUTADOR") });
    rerender(
      <GuestOnly>
        <p>{FORM}</p>
      </GuestOnly>,
    );

    expect(mocks.router.replace).toHaveBeenCalledWith("/recrutador");
    expect(form()).toBeNull();
  });
});
