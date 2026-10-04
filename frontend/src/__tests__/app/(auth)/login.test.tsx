import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { use } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/(auth)/login/page";
import { ApiError } from "@/lib/api";
import type { LoginResponse } from "@/types/auth";

vi.setConfig({ testTimeout: 15_000 });

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  login: vi.fn(),
  loginCompleted: vi.fn(),
  params: new URLSearchParams(),
  suspend: false,
  policy: "reduced",
  pending: new Promise<never>(() => undefined),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => {
    if (mocks.suspend) use(mocks.pending);
    return mocks.params;
  },
}));
vi.mock("@/lib/auth", () => ({ login: mocks.login }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ loginCompleted: mocks.loginCompleted }) }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => mocks.policy }));

const EMAIL_LABEL = "E-mail";
const PASSWORD_LABEL = "Senha";
const SUBMIT = "Entrar";
const LOADING = "Entrando...";
const TYPED_EMAIL = "  Ana@Example.COM ";
const NORMALIZED_EMAIL = "ana@example.com";
const SECRET = "Segredo123";
const UNAUTHORIZED = "Unauthorized";
const HOME = "/aluno";
const RESPONSE: LoginResponse = {
  usuario: { id: "1", nome: "Ana", email: NORMALIZED_EMAIL, role: "ALUNO" },
  destinoInicial: HOME,
};
const PAUSE_MS = 700;

function renderLogin(search = "") {
  mocks.params = new URLSearchParams(search);
  return render(<LoginPage />);
}

function emailInput() {
  return screen.getByRole("textbox", { name: EMAIL_LABEL });
}

function passwordInput() {
  return screen.getByLabelText(PASSWORD_LABEL);
}

function submitButton() {
  return screen.getByRole("button", { name: SUBMIT });
}

type User = ReturnType<typeof userEvent.setup>;

async function fillField(user: User, field: HTMLElement, value: string) {
  await user.click(field);
  await user.paste(value);
}

async function fillForm(user: User, email = TYPED_EMAIL, password = SECRET) {
  await fillField(user, emailInput(), email);
  await fillField(user, passwordInput(), password);
}

async function fillAndSubmit(user: User, email = TYPED_EMAIL, password = SECRET) {
  await fillForm(user, email, password);
  await user.click(submitButton());
}

// user-event waits on real timers, so the form is filled before the clock is faked.
async function fillThenSubmitWithFakeTimers() {
  const view = renderLogin();
  await fillForm(userEvent.setup({ delay: null }));
  vi.useFakeTimers();
  fireEvent.click(submitButton());
  return view;
}

function pendingLogin() {
  let resolve: (value: LoginResponse) => void = () => undefined;
  const promise = new Promise<LoginResponse>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("login page", () => {
  beforeEach(() => {
    mocks.suspend = false;
    mocks.policy = "reduced";
    mocks.login.mockResolvedValue(RESPONSE);
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "execCommand");
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("layout", () => {
    it("shows the fallback while the search params are not available", () => {
      mocks.suspend = true;
      renderLogin();
      expect(screen.getByRole("status").textContent).toContain("Carregando...");
      expect(screen.queryByRole("heading", { name: "Entrar no Talent Valley" })).toBeNull();
    });

    it("renders the form with its navigation links", () => {
      renderLogin();
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Entrar no Talent Valley");
      expect(screen.getByText("Acesse sua conta para continuar")).toBeTruthy();
      expect(screen.getByRole("link", { name: "Esqueceu sua senha?" }).getAttribute("href")).toBe("/esqueci-senha");
      expect(screen.getByRole("link", { name: "Solicitar cadastro" }).getAttribute("href")).toBe("/cadastro");
      expect(screen.getByRole("link", { name: "Voltar para o início" }).getAttribute("href")).toBe("/");
      expect(passwordInput().getAttribute("type")).toBe("password");
      expect(passwordInput().getAttribute("autocomplete")).toBe("current-password");
    });

    it("tells the user when the session expired", () => {
      renderLogin("sessao=expirada");
      expect(screen.getByRole("alert").textContent).toBe("Sua sessão expirou. Entre novamente para continuar.");
    });

    it("does not show the expiry notice for other values of the param", () => {
      renderLogin("sessao=outra");
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("input handling", () => {
    it("strips emoji from the e-mail while typing", async () => {
      const user = userEvent.setup({ delay: null });
      renderLogin();
      await user.type(emailInput(), "a😀na@x.com");
      expect((emailInput() as HTMLInputElement).value).toBe("ana@x.com");
    });

    it("limits the e-mail to 254 characters", async () => {
      const user = userEvent.setup({ delay: null });
      renderLogin();
      await user.click(emailInput());
      await user.paste("a".repeat(300));
      expect((emailInput() as HTMLInputElement).value).toHaveLength(254);
    });

    it("replaces a pasted text that contains emoji with its clean version", async () => {
      const user = userEvent.setup({ delay: null });
      const execCommand = vi.fn();
      Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
      renderLogin();
      await user.click(emailInput());
      await user.paste("a😀@x.com");
      expect(execCommand).toHaveBeenCalledWith("insertText", false, "a@x.com");
    });
  });

  describe("validation", () => {
    it("asks for the e-mail and focuses it when it is empty", async () => {
      const user = userEvent.setup({ delay: null });
      renderLogin();
      await user.click(submitButton());
      expect(screen.getByRole("alert").textContent).toBe("Informe seu e-mail.");
      expect(document.activeElement).toBe(emailInput());
      expect(mocks.login).not.toHaveBeenCalled();
    });

    it("rejects a malformed e-mail", async () => {
      const user = userEvent.setup({ delay: null });
      renderLogin();
      await user.type(emailInput(), "sem-arroba");
      await user.click(submitButton());
      expect(screen.getByRole("alert").textContent).toBe("Informe um e-mail válido.");
      expect(document.activeElement).toBe(emailInput());
      expect(mocks.login).not.toHaveBeenCalled();
    });

    it("asks for the password and focuses it when it is empty", async () => {
      const user = userEvent.setup({ delay: null });
      renderLogin();
      await user.type(emailInput(), NORMALIZED_EMAIL);
      await user.click(submitButton());
      expect(screen.getByRole("alert").textContent).toBe("Informe sua senha.");
      expect(document.activeElement).toBe(passwordInput());
      expect(mocks.login).not.toHaveBeenCalled();
    });

    it("moves focus to the field again when the same error repeats", async () => {
      const user = userEvent.setup({ delay: null });
      renderLogin();
      await user.click(submitButton());
      emailInput().blur();
      await user.click(submitButton());
      expect(document.activeElement).toBe(emailInput());
    });

    it("hides the session expiry notice once an error is shown", async () => {
      const user = userEvent.setup({ delay: null });
      renderLogin("sessao=expirada");
      await user.click(submitButton());
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      expect(screen.getByRole("alert").textContent).toBe("Informe seu e-mail.");
    });
  });

  describe("submission", () => {
    it("sends the normalized e-mail and the password, then opens the initial destination", async () => {
      const user = userEvent.setup({ delay: null });
      renderLogin();
      await fillAndSubmit(user);
      expect(mocks.login).toHaveBeenCalledWith({ email: NORMALIZED_EMAIL, senha: SECRET });
      expect(mocks.loginCompleted).toHaveBeenCalledWith(RESPONSE.usuario);
      expect(mocks.replace).toHaveBeenCalledWith(HOME);
    });

    it("shows the busy state and locks the form while the request is in flight", async () => {
      const user = userEvent.setup({ delay: null });
      const request = pendingLogin();
      mocks.login.mockReturnValue(request.promise);
      renderLogin();
      await fillAndSubmit(user);

      const button = screen.getByRole("button", { name: LOADING });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect((emailInput() as HTMLInputElement).disabled).toBe(true);
      expect((passwordInput() as HTMLInputElement).disabled).toBe(true);
      expect(button.closest("form")?.getAttribute("aria-busy")).toBe("true");
      expect(mocks.replace).not.toHaveBeenCalled();

      await act(async () => request.resolve(RESPONSE));
      expect(mocks.replace).toHaveBeenCalledWith(HOME);
    });

    it("draws the success check for a moment before publishing the session", async () => {
      mocks.policy = "touch";
      await fillThenSubmitWithFakeTimers();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(PAUSE_MS - 100);
      });
      expect(screen.getByRole("button", { name: LOADING }).getAttribute("type")).toBe("button");
      expect((emailInput() as HTMLInputElement).disabled).toBe(true);
      expect(mocks.loginCompleted).not.toHaveBeenCalled();
      expect(mocks.replace).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(200);
      });
      expect(mocks.loginCompleted).toHaveBeenCalledWith(RESPONSE.usuario);
      expect(mocks.replace).toHaveBeenCalledWith(HOME);
    });

    it("does not publish the session nor navigate if the user left during the pause", async () => {
      mocks.policy = "pointer";
      const { unmount } = await fillThenSubmitWithFakeTimers();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });

      unmount();
      await vi.advanceTimersByTimeAsync(PAUSE_MS);

      expect(mocks.loginCompleted).not.toHaveBeenCalled();
      expect(mocks.replace).not.toHaveBeenCalled();
    });
  });

  describe("return url", () => {
    it("goes back to a local path requested by the user", async () => {
      const user = userEvent.setup({ delay: null });
      renderLogin("returnUrl=%2Frecrutador%2Fbusca");
      await fillAndSubmit(user);
      expect(mocks.replace).toHaveBeenCalledWith("/recrutador/busca");
    });

    it.each([
      ["a protocol-relative url", "//evil.example.com"],
      ["an absolute url", "https://evil.example.com"],
      ["a relative path without a leading slash", "recrutador"],
    ])("ignores %s and uses the initial destination", async (_label, returnUrl) => {
      const user = userEvent.setup({ delay: null });
      renderLogin(`returnUrl=${encodeURIComponent(returnUrl)}`);
      await fillAndSubmit(user);
      expect(mocks.replace).toHaveBeenCalledWith(HOME);
    });
  });

  describe("failures", () => {
    it("explains wrong credentials and focuses the error summary", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.login.mockRejectedValue(new ApiError(401, UNAUTHORIZED));
      renderLogin();
      await fillAndSubmit(user);

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe("E-mail ou senha incorretos.");
      await waitFor(() => expect(document.activeElement).toBe(alert));
      expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
      expect((emailInput() as HTMLInputElement).disabled).toBe(false);
      expect(mocks.loginCompleted).not.toHaveBeenCalled();
      expect(mocks.replace).not.toHaveBeenCalled();
    });

    it("keeps what the user typed after a failure", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.login.mockRejectedValue(new ApiError(401, UNAUTHORIZED));
      renderLogin();
      await fillAndSubmit(user, NORMALIZED_EMAIL);
      expect((emailInput() as HTMLInputElement).value).toBe(NORMALIZED_EMAIL);
      expect((passwordInput() as HTMLInputElement).value).toBe(SECRET);
    });

    it.each([
      [403, "Acesso indisponível para esta conta."],
      [423, "Conta temporariamente bloqueada. Tente novamente mais tarde."],
      [500, "Não foi possível fazer login. Tente novamente."],
    ])("maps status %i to a friendly message", async (status, message) => {
      const user = userEvent.setup({ delay: null });
      mocks.login.mockRejectedValue(new ApiError(status, "Server text"));
      renderLogin();
      await fillAndSubmit(user);
      expect(screen.getByRole("alert").textContent).toBe(message);
    });

    it("reports a connection problem when the request itself fails", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.login.mockRejectedValue(new TypeError("Failed to fetch"));
      renderLogin();
      await fillAndSubmit(user);
      expect(screen.getByRole("alert").textContent).toBe("Não foi possível conectar ao servidor. Tente novamente.");
    });

    it("lets the user try again after a failure", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.login.mockRejectedValueOnce(new ApiError(401, UNAUTHORIZED));
      renderLogin();
      await fillAndSubmit(user, NORMALIZED_EMAIL);
      await user.click(submitButton());
      expect(mocks.login).toHaveBeenCalledTimes(2);
      expect(mocks.replace).toHaveBeenCalledWith(HOME);
      expect(screen.queryByText("E-mail ou senha incorretos.")).toBeNull();
    });
  });

  describe("rate limiting", () => {
    it("blocks the button with a countdown for the wait the server asked and releases it afterwards", async () => {
      mocks.login.mockRejectedValue(new ApiError(429, "Too many", undefined, 30));
      await fillThenSubmitWithFakeTimers();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByRole("alert").textContent).toBe("Muitas tentativas. Aguarde 30 segundos e tente novamente.");
      const waiting = screen.getByRole("button", { name: "Tente de novo em 30 s" });
      expect((waiting as HTMLButtonElement).disabled).toBe(true);

      act(() => {
        vi.advanceTimersByTime(10_000);
      });
      expect(screen.getByRole("button", { name: "Tente de novo em 20 s" })).toBeTruthy();

      act(() => {
        vi.advanceTimersByTime(21_000);
      });
      expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
      expect(mocks.login).toHaveBeenCalledTimes(1);
    });

    it("does not start a countdown when the server gives no wait time", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.login.mockRejectedValue(new ApiError(429, "Too many"));
      renderLogin();
      await fillAndSubmit(user);
      expect(screen.getByRole("alert").textContent).toBe("Muitas tentativas. Aguarde um instante e tente novamente.");
      expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
    });
  });

  describe("credential safety", () => {
    it("does not persist the password nor the session in browser storage or the console", async () => {
      const user = userEvent.setup({ delay: null });
      const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
        vi.spyOn(console, method).mockImplementation(() => undefined),
      );
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      renderLogin();
      await fillAndSubmit(user);

      expect(mocks.replace).toHaveBeenCalledWith(HOME);
      expect(setItem).not.toHaveBeenCalled();
      expect(localStorage).toHaveLength(0);
      expect(sessionStorage).toHaveLength(0);
      for (const spy of consoleSpies) {
        expect(spy).not.toHaveBeenCalled();
      }
    });
  });
});
