import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { ApiError } from "@/lib/api";
import { buildAuth, userWith, type AuthMock } from "../auth/authMock";

vi.setConfig({ testTimeout: 15_000 });

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  auth: {} as AuthMock, // replaced with buildAuth() before every test
}));

vi.mock("@/lib/auth", () => ({ changePassword: mocks.changePassword }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));

const CURRENT_PASSWORD = "Atual1234";
const NEW_PASSWORD = "Segredo123";
const SUBMIT = "Alterar senha";
const BACK_LINK = "Voltar à minha área";
const FALLBACK_MESSAGE = "Não foi possível alterar a senha. Tente novamente.";

type User = ReturnType<typeof userEvent.setup>;

function currentInput() {
  return screen.getByLabelText("Senha atual");
}

function newInput() {
  return screen.getByLabelText("Nova senha");
}

function confirmationInput() {
  return screen.getByLabelText("Confirmação da nova senha");
}

function submitButton() {
  return screen.getByRole("button", { name: SUBMIT });
}

async function fillField(user: User, field: HTMLElement, value: string) {
  await user.click(field);
  await user.paste(value);
}

async function fillForm(user: User, current = CURRENT_PASSWORD, next = NEW_PASSWORD, confirmation = next) {
  if (current) await fillField(user, currentInput(), current);
  if (next) await fillField(user, newInput(), next);
  if (confirmation) await fillField(user, confirmationInput(), confirmation);
}

async function fillAndSubmit(user: User, current = CURRENT_PASSWORD, next = NEW_PASSWORD, confirmation = next) {
  await fillForm(user, current, next, confirmation);
  await user.click(submitButton());
}

function validationProblem(field: string): ApiError {
  return new ApiError(400, "Validation", { title: "Validation", status: 400, errors: { [field]: ["invalid"] } });
}

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    mocks.auth = buildAuth({ user: userWith("ALUNO") });
    mocks.changePassword.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("layout", () => {
    it("shows the title, the three password fields and the rules of the new password", () => {
      render(<ChangePasswordForm />);
      expect(screen.getByText("MINHA CONTA")).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Alterar senha");
      expect(screen.getByText("Informe sua senha atual e escolha uma nova")).toBeTruthy();
      expect(currentInput().getAttribute("autocomplete")).toBe("current-password");
      expect(newInput().getAttribute("autocomplete")).toBe("new-password");
      expect(confirmationInput().getAttribute("autocomplete")).toBe("new-password");
      expect(screen.getByText(/Força da senha/)).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it.each([
      ["ALUNO", "/meu-perfil"],
      ["RECRUTADOR", "/recrutador"],
      ["ADMIN", "/admin"],
    ] as const)("links back to the area of the %s role", (role, href) => {
      mocks.auth = buildAuth({ user: userWith(role) });
      render(<ChangePasswordForm />);
      expect(screen.getByRole("link", { name: BACK_LINK }).getAttribute("href")).toBe(href);
    });

    it("links back to the login when there is no signed-in user", () => {
      mocks.auth = buildAuth({ user: null });
      render(<ChangePasswordForm />);
      expect(screen.getByRole("link", { name: BACK_LINK }).getAttribute("href")).toBe("/login");
    });
  });

  describe("validation", () => {
    it("asks for the current password and focuses it", async () => {
      const user = userEvent.setup({ delay: null });
      render(<ChangePasswordForm />);
      await fillAndSubmit(user, "");
      expect(screen.getByRole("alert").textContent).toBe("Informe sua senha atual.");
      expect(document.activeElement).toBe(currentInput());
      expect(mocks.changePassword).not.toHaveBeenCalled();
    });

    it.each([
      ["too short", "Abc1", "A senha deve ter pelo menos 8 caracteres."],
      ["without an uppercase letter", "segredo123", "A senha deve conter pelo menos uma letra maiúscula."],
      ["without a lowercase letter", "SEGREDO123", "A senha deve conter pelo menos uma letra minúscula."],
      ["without a digit", "SegredoSegredo", "A senha deve conter pelo menos um dígito."],
    ])("rejects a new password %s and focuses the new password field", async (_label, password, message) => {
      const user = userEvent.setup({ delay: null });
      render(<ChangePasswordForm />);
      await fillAndSubmit(user, CURRENT_PASSWORD, password);
      expect(screen.getByRole("alert").textContent).toBe(message);
      expect(document.activeElement).toBe(newInput());
      expect(mocks.changePassword).not.toHaveBeenCalled();
    });

    it("rejects a confirmation that differs and focuses it", async () => {
      const user = userEvent.setup({ delay: null });
      render(<ChangePasswordForm />);
      await fillAndSubmit(user, CURRENT_PASSWORD, NEW_PASSWORD, `${NEW_PASSWORD}x`);
      expect(screen.getByRole("alert").textContent).toBe("As senhas não coincidem.");
      expect(document.activeElement).toBe(confirmationInput());
      expect(mocks.changePassword).not.toHaveBeenCalled();
    });

    it("moves focus back to the field when the same error is reported twice in a row", async () => {
      const user = userEvent.setup({ delay: null });
      render(<ChangePasswordForm />);
      await fillAndSubmit(user, CURRENT_PASSWORD, NEW_PASSWORD, "diferente");
      confirmationInput().blur();
      await user.click(submitButton());
      expect(screen.getByRole("alert").textContent).toBe("As senhas não coincidem.");
      expect(document.activeElement).toBe(confirmationInput());
    });

    it("clears the previous error as soon as the form is submitted again", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.changePassword.mockReturnValue(new Promise(() => undefined));
      render(<ChangePasswordForm />);
      await fillAndSubmit(user, CURRENT_PASSWORD, NEW_PASSWORD, "diferente");
      expect(screen.getByRole("alert").textContent).toBe("As senhas não coincidem.");
      await user.clear(confirmationInput());
      await fillField(user, confirmationInput(), NEW_PASSWORD);
      await user.click(submitButton());
      expect(screen.getByRole("button", { name: "Alterando..." })).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("submission", () => {
    it("sends only the current and the new password", async () => {
      const user = userEvent.setup({ delay: null });
      render(<ChangePasswordForm />);
      await fillAndSubmit(user);
      expect(mocks.changePassword).toHaveBeenCalledTimes(1);
      expect(mocks.changePassword).toHaveBeenCalledWith({ senhaAtual: CURRENT_PASSWORD, novaSenha: NEW_PASSWORD });
    });

    it("confirms the change, keeps the session message and links back to the user area", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.auth = buildAuth({ user: userWith("RECRUTADOR") });
      render(<ChangePasswordForm />);
      await fillAndSubmit(user);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Senha alterada");
      expect(screen.getByRole("alert").textContent).toBe(
        "Sua senha foi alterada. Você continua conectado neste dispositivo; as demais sessões foram encerradas.",
      );
      expect(screen.getByRole("link", { name: BACK_LINK }).getAttribute("href")).toBe("/recrutador");
      expect(screen.queryByLabelText("Senha atual")).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("alert")));
    });

    it("shows the busy state and locks the form while the request is in flight", async () => {
      const user = userEvent.setup({ delay: null });
      let finish: () => void = () => undefined;
      mocks.changePassword.mockReturnValue(
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );
      render(<ChangePasswordForm />);
      await fillAndSubmit(user);

      const button = screen.getByRole("button", { name: "Alterando..." });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect((currentInput() as HTMLInputElement).disabled).toBe(true);
      expect((newInput() as HTMLInputElement).disabled).toBe(true);
      expect((confirmationInput() as HTMLInputElement).disabled).toBe(true);
      expect(button.closest("form")?.getAttribute("aria-busy")).toBe("true");

      await act(async () => finish());
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Senha alterada");
    });

    it("does not persist any password in browser storage", async () => {
      const user = userEvent.setup({ delay: null });
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      render(<ChangePasswordForm />);
      await fillAndSubmit(user);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Senha alterada");
      expect(setItem).not.toHaveBeenCalled();
    });
  });

  describe("failures", () => {
    it("reports a wrong current password (400 on senhaAtual) and focuses that field", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.changePassword.mockRejectedValue(validationProblem("senhaAtual"));
      render(<ChangePasswordForm />);
      await fillAndSubmit(user);
      expect(screen.getByRole("alert").textContent).toBe("A senha atual está incorreta.");
      await waitFor(() => expect(document.activeElement).toBe(currentInput()));
      expect((newInput() as HTMLInputElement).value).toBe(NEW_PASSWORD);
    });

    it("reports a rejected new password (400 on novaSenha) and focuses that field", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.changePassword.mockRejectedValue(validationProblem("novaSenha"));
      render(<ChangePasswordForm />);
      await fillAndSubmit(user);
      expect(screen.getByRole("alert").textContent).toBe("A nova senha não atende aos requisitos de segurança.");
      await waitFor(() => expect(document.activeElement).toBe(newInput()));
    });

    it("uses the generic message for a 400 that names no known field and focuses the alert", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.changePassword.mockRejectedValue(validationProblem("outro"));
      render(<ChangePasswordForm />);
      await fillAndSubmit(user);
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe(FALLBACK_MESSAGE);
      await waitFor(() => expect(document.activeElement).toBe(alert));
    });

    it.each([
      [401, "Sua sessão expirou. Entre novamente."],
      [403, "Acesso indisponível para esta conta."],
      [423, "Conta temporariamente bloqueada. Tente novamente mais tarde."],
      [500, FALLBACK_MESSAGE],
    ])("keeps the form and maps status %i to a friendly message", async (status, message) => {
      const user = userEvent.setup({ delay: null });
      mocks.changePassword.mockRejectedValue(new ApiError(status, "Server text"));
      render(<ChangePasswordForm />);
      await fillAndSubmit(user);
      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe(message);
      await waitFor(() => expect(document.activeElement).toBe(alert));
      expect((currentInput() as HTMLInputElement).value).toBe(CURRENT_PASSWORD);
      expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
    });

    it("reports a connection problem when the request itself fails", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.changePassword.mockRejectedValue(new TypeError("Failed to fetch"));
      render(<ChangePasswordForm />);
      await fillAndSubmit(user);
      expect(screen.getByRole("alert").textContent).toBe("Não foi possível conectar ao servidor. Tente novamente.");
    });

    it("blocks the button with a countdown for the wait the server asked and releases it afterwards", async () => {
      mocks.changePassword.mockRejectedValue(new ApiError(429, "Too many", undefined, 90));
      render(<ChangePasswordForm />);
      await fillForm(userEvent.setup({ delay: null }));
      vi.useFakeTimers();
      fireEvent.click(submitButton());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const waiting = screen.getByRole("button", { name: "Tente de novo em 1:30" });
      expect((waiting as HTMLButtonElement).disabled).toBe(true);

      act(() => {
        vi.advanceTimersByTime(91_000);
      });
      expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
      expect(mocks.changePassword).toHaveBeenCalledTimes(1);
    });
  });
});
