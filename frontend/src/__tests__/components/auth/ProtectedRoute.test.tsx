import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import type { UserRole } from "@/types/auth";
import { buildAuth, userWith, type AuthMock } from "./authMock";

const mocks = vi.hoisted(() => ({
  auth: null as unknown as AuthMock,
  router: { replace: vi.fn() },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/components/auth/AccessDenied", () => ({
  AccessDenied: ({ role }: { role: UserRole }) => <div data-testid="denied" data-role={role} />,
}));

const SECRET = "conteúdo protegido";
const ERROR_MESSAGE = "Não foi possível verificar sua sessão. Tente novamente.";
const LOGIN = "/login";

function setAuth(partial: Partial<AuthMock>) {
  mocks.auth = buildAuth(partial);
}

function renderRoute(allowedRoles?: UserRole[]) {
  return render(
    <ProtectedRoute allowedRoles={allowedRoles}>
      <p>{SECRET}</p>
    </ProtectedRoute>,
  );
}

function secret() {
  return screen.queryByText(SECRET);
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    mocks.router.replace.mockReset();
    setAuth({});
  });

  describe("while the session is being checked", () => {
    it("shows a loading status and never renders the protected content", () => {
      setAuth({ loading: true });
      renderRoute();

      expect(screen.getByRole("status", { name: "Carregando" })).not.toBeNull();
      expect(secret()).toBeNull();
    });

    it("does not leak the content even if a user is already known", () => {
      setAuth({ loading: true, user: userWith("ADMIN") });
      renderRoute(["ADMIN"]);

      expect(secret()).toBeNull();
      expect(screen.getByRole("status")).not.toBeNull();
    });

    it("does not redirect yet", () => {
      setAuth({ loading: true });
      renderRoute();

      expect(mocks.router.replace).not.toHaveBeenCalled();
    });
  });

  describe("when nobody is signed in", () => {
    it("redirects to the login and renders nothing", () => {
      const { container } = renderRoute();

      expect(mocks.router.replace).toHaveBeenCalledTimes(1);
      expect(mocks.router.replace).toHaveBeenCalledWith(LOGIN);
      expect(container.textContent).toBe("");
      expect(secret()).toBeNull();
    });

    it("redirects even when roles are required", () => {
      renderRoute(["ALUNO"]);

      expect(mocks.router.replace).toHaveBeenCalledWith(LOGIN);
      expect(secret()).toBeNull();
    });
  });

  describe("when the session check failed operationally", () => {
    it("shows the error with a retry, without redirecting or rendering the content", async () => {
      const user = userEvent.setup();
      setAuth({ error: ERROR_MESSAGE });
      renderRoute();

      expect(screen.getByRole("alert").textContent).toBe(ERROR_MESSAGE);
      expect(secret()).toBeNull();
      expect(mocks.router.replace).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

      expect(mocks.auth.refreshUser).toHaveBeenCalledTimes(1);
    });

    it("keeps showing the content to a known user whose refresh failed", () => {
      setAuth({ user: userWith("ALUNO"), error: ERROR_MESSAGE });
      renderRoute();

      expect(secret()).not.toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(mocks.router.replace).not.toHaveBeenCalled();
    });
  });

  describe("when a user is signed in", () => {
    it("renders the content when no roles are required", () => {
      setAuth({ user: userWith("RECRUTADOR") });
      renderRoute();

      expect(secret()).not.toBeNull();
      expect(mocks.router.replace).not.toHaveBeenCalled();
    });

    it.each<UserRole>(["ALUNO", "RECRUTADOR", "ADMIN"])("renders the content to an allowed %s", (role) => {
      setAuth({ user: userWith(role) });
      renderRoute([role]);

      expect(secret()).not.toBeNull();
      expect(screen.queryByTestId("denied")).toBeNull();
    });

    it("renders the content when the role is one of several allowed", () => {
      setAuth({ user: userWith("RECRUTADOR") });
      renderRoute(["ADMIN", "RECRUTADOR"]);

      expect(secret()).not.toBeNull();
    });

    it.each<[UserRole, UserRole[]]>([
      ["ALUNO", ["RECRUTADOR"]],
      ["RECRUTADOR", ["ADMIN"]],
      ["ADMIN", ["ALUNO", "RECRUTADOR"]],
    ])("shows access denied to a %s outside %j, without the content or a redirect", (role, allowed) => {
      setAuth({ user: userWith(role) });
      renderRoute(allowed);

      expect(screen.getByTestId("denied").getAttribute("data-role")).toBe(role);
      expect(secret()).toBeNull();
      expect(mocks.router.replace).not.toHaveBeenCalled();
    });

    it("denies everyone when the allowed list is empty", () => {
      setAuth({ user: userWith("ADMIN") });
      renderRoute([]);

      expect(screen.getByTestId("denied")).not.toBeNull();
      expect(secret()).toBeNull();
    });
  });

  describe("when the session ends while the page is open", () => {
    it("removes the content and sends the visitor to the login", () => {
      setAuth({ user: userWith("ALUNO") });
      const { rerender } = renderRoute(["ALUNO"]);
      expect(secret()).not.toBeNull();
      expect(mocks.router.replace).not.toHaveBeenCalled();

      setAuth({ user: null });
      rerender(
        <ProtectedRoute allowedRoles={["ALUNO"]}>
          <p>{SECRET}</p>
        </ProtectedRoute>,
      );

      expect(secret()).toBeNull();
      expect(mocks.router.replace).toHaveBeenCalledWith(LOGIN);
    });

    it("redirects only after the loading is over", () => {
      setAuth({ loading: true });
      const { rerender } = renderRoute();
      expect(mocks.router.replace).not.toHaveBeenCalled();

      setAuth({ loading: false });
      rerender(
        <ProtectedRoute>
          <p>{SECRET}</p>
        </ProtectedRoute>,
      );

      expect(mocks.router.replace).toHaveBeenCalledWith(LOGIN);
    });
  });
});
