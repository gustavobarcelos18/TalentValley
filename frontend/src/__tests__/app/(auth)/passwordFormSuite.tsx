import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ApiError } from "@/lib/api";

const CONFIRM_STATUS_MESSAGES: [number, string][] = [
  [401, "Sua sessão expirou. Entre novamente."],
  [403, "Acesso indisponível para esta conta."],
  [423, "Conta temporariamente bloqueada. Tente novamente mais tarde."],
];
const EMAIL = "ana@example.com";
const TOKEN = "abc+123/xyz=";
const LINK = `email=${encodeURIComponent(EMAIL)}&token=${encodeURIComponent(TOKEN)}`;
const VALID_PASSWORD = "Segredo123";
const MISMATCH_MESSAGE = "As senhas não coincidem.";
const INVALID_LINK_TITLE = "Link inválido ou expirado";
const NEW_LINK_ACTION = "Solicitar novo link";
const BACK_TO_LOGIN = "Voltar ao login";

type User = ReturnType<typeof userEvent.setup>;

export type PasswordFormSuiteConfig = {
  suiteName: string;
  renderPage: (search: string) => void;
  setSuspend: (suspend: boolean) => void;
  api: Mock;
  passwordKey: "senha" | "novaSenha";
  passwordLabel: string;
  confirmationLabel: string;
  submit: string;
  loading: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  doneTitle: string;
  doneMessage: string;
  fallbackMessage: string;
  incompleteMessage: string;
  rejectedMessage: string;
  newLinkHref: string;
  titles: { submitsPayload: string; confirmsDone: string; renders: string };
};

export function describePasswordFormPage(config: PasswordFormSuiteConfig) {
  const { api, renderPage } = config;

  function passwordInput() {
    return screen.getByLabelText(config.passwordLabel);
  }

  function confirmationInput() {
    return screen.getByLabelText(config.confirmationLabel);
  }

  function submitButton() {
    return screen.getByRole("button", { name: config.submit });
  }

  async function fillField(user: User, field: HTMLElement, value: string) {
    await user.click(field);
    await user.paste(value);
  }

  async function fillForm(user: User, password = VALID_PASSWORD, confirmation = password) {
    await fillField(user, passwordInput(), password);
    await fillField(user, confirmationInput(), confirmation);
  }

  async function fillAndSubmit(user: User, password = VALID_PASSWORD, confirmation = password) {
    await fillForm(user, password, confirmation);
    await user.click(submitButton());
  }

  function expectInvalidLinkScreen(message: string) {
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(INVALID_LINK_TITLE);
    expect(screen.getByRole("alert").textContent).toBe(message);
    expect(screen.getByRole("link", { name: NEW_LINK_ACTION }).getAttribute("href")).toBe(config.newLinkHref);
    expect(screen.getByRole("link", { name: BACK_TO_LOGIN }).getAttribute("href")).toBe("/login");
    expect(screen.queryByLabelText(config.passwordLabel)).toBeNull();
  }

  describe(config.suiteName, () => {
    beforeEach(() => {
      config.setSuspend(false);
      api.mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
      vi.clearAllMocks();
    });

    describe("layout", () => {
      it("shows the fallback while the search params are not available", () => {
        config.setSuspend(true);
        renderPage(LINK);
        expect(screen.getByRole("status").textContent).toContain("Carregando...");
        expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
      });

      it(config.titles.renders, () => {
        renderPage(LINK);
        expect(screen.getByText(config.eyebrow)).toBeTruthy();
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(config.title);
        expect(screen.getByText(config.subtitle)).toBeTruthy();
        expect(passwordInput().getAttribute("autocomplete")).toBe("new-password");
        expect(confirmationInput().getAttribute("autocomplete")).toBe("new-password");
        expect(screen.getByText(/Força da senha/)).toBeTruthy();
        expect(screen.getByRole("link", { name: BACK_TO_LOGIN }).getAttribute("href")).toBe("/login");
        expect(screen.queryByRole("alert")).toBeNull();
      });
    });

    describe("incomplete link", () => {
      it.each([
        ["without the e-mail", `token=${TOKEN}`],
        ["without the token", `email=${EMAIL}`],
        ["without any param", ""],
      ])("explains a link %s and offers a new one", (_label, search) => {
        renderPage(search);
        expectInvalidLinkScreen(config.incompleteMessage);
        expect(api).not.toHaveBeenCalled();
      });

      it("moves focus to the explanation", async () => {
        renderPage("");
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("alert")));
      });
    });

    describe("validation", () => {
      it.each([
        ["too short", "Abc1", "A senha deve ter pelo menos 8 caracteres."],
        ["without an uppercase letter", "segredo123", "A senha deve conter pelo menos uma letra maiúscula."],
        ["without a lowercase letter", "SEGREDO123", "A senha deve conter pelo menos uma letra minúscula."],
        ["without a digit", "SegredoSegredo", "A senha deve conter pelo menos um dígito."],
      ])("rejects a password %s and focuses the password field", async (_label, password, message) => {
        const user = userEvent.setup({ delay: null });
        renderPage(LINK);
        await fillAndSubmit(user, password);
        expect(screen.getByRole("alert").textContent).toBe(message);
        expect(document.activeElement).toBe(passwordInput());
        expect(api).not.toHaveBeenCalled();
      });

      it("rejects a confirmation that differs and focuses it", async () => {
        const user = userEvent.setup({ delay: null });
        renderPage(LINK);
        await fillAndSubmit(user, VALID_PASSWORD, `${VALID_PASSWORD}x`);
        expect(screen.getByRole("alert").textContent).toBe(MISMATCH_MESSAGE);
        expect(document.activeElement).toBe(confirmationInput());
        expect(api).not.toHaveBeenCalled();
      });

      it("clears the previous error as soon as the form is submitted again", async () => {
        const user = userEvent.setup({ delay: null });
        api.mockReturnValue(new Promise(() => undefined));
        renderPage(LINK);
        await fillAndSubmit(user, VALID_PASSWORD, "diferente");
        expect(screen.getByRole("alert").textContent).toBe(MISMATCH_MESSAGE);
        await user.clear(confirmationInput());
        await fillField(user, confirmationInput(), VALID_PASSWORD);
        await user.click(submitButton());
        expect(screen.getByRole("button", { name: config.loading })).toBeTruthy();
        expect(screen.queryByRole("alert")).toBeNull();
      });
    });

    describe("submission", () => {
      it(config.titles.submitsPayload, async () => {
        const user = userEvent.setup({ delay: null });
        renderPage(LINK);
        await fillAndSubmit(user);
        expect(api).toHaveBeenCalledWith({ email: EMAIL, token: TOKEN, [config.passwordKey]: VALID_PASSWORD });
      });

      it(config.titles.confirmsDone, async () => {
        const user = userEvent.setup({ delay: null });
        renderPage(LINK);
        await fillAndSubmit(user);
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(config.doneTitle);
        expect(screen.getByRole("alert").textContent).toBe(config.doneMessage);
        expect(screen.getByRole("link", { name: "Ir para o login" }).getAttribute("href")).toBe("/login");
        expect(screen.queryByLabelText(config.passwordLabel)).toBeNull();
        await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("alert")));
      });

      it("shows the busy state and locks the form while the request is in flight", async () => {
        const user = userEvent.setup({ delay: null });
        let finish: () => void = () => undefined;
        api.mockReturnValue(
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
        );
        renderPage(LINK);
        await fillAndSubmit(user);

        const button = screen.getByRole("button", { name: config.loading });
        expect((button as HTMLButtonElement).disabled).toBe(true);
        expect((passwordInput() as HTMLInputElement).disabled).toBe(true);
        expect((confirmationInput() as HTMLInputElement).disabled).toBe(true);
        expect(button.closest("form")?.getAttribute("aria-busy")).toBe("true");

        await act(async () => finish());
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(config.doneTitle);
      });
    });

    describe("failures", () => {
      it("treats a rejected link (400) as expired or already used", async () => {
        const user = userEvent.setup({ delay: null });
        api.mockRejectedValue(new ApiError(400, "Invalid token"));
        renderPage(LINK);
        await fillAndSubmit(user);
        expectInvalidLinkScreen(config.rejectedMessage);
      });

      it.each([...CONFIRM_STATUS_MESSAGES, [500, config.fallbackMessage]])(
        "keeps the form and maps status %i to a friendly message",
        async (status, message) => {
          const user = userEvent.setup({ delay: null });
          api.mockRejectedValue(new ApiError(Number(status), "Server text"));
          renderPage(LINK);
          await fillAndSubmit(user);

          const alert = screen.getByRole("alert");
          expect(alert.textContent).toBe(message);
          await waitFor(() => expect(document.activeElement).toBe(alert));
          expect((passwordInput() as HTMLInputElement).value).toBe(VALID_PASSWORD);
          expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
        },
      );

      it("reports a connection problem when the request itself fails", async () => {
        const user = userEvent.setup({ delay: null });
        api.mockRejectedValue(new TypeError("Failed to fetch"));
        renderPage(LINK);
        await fillAndSubmit(user);
        expect(screen.getByRole("alert").textContent).toBe("Não foi possível conectar ao servidor. Tente novamente.");
      });

      it("blocks the button with a countdown for the wait the server asked and releases it afterwards", async () => {
        api.mockRejectedValue(new ApiError(429, "Too many", undefined, 90));
        renderPage(LINK);
        await fillForm(userEvent.setup({ delay: null }));
        vi.useFakeTimers();
        fireEvent.click(submitButton());
        await act(async () => {
          await vi.advanceTimersByTimeAsync(0);
        });

        expect(screen.getByRole("alert").textContent).toBe("Muitas tentativas. Aguarde 2 minutos e tente novamente.");
        const waiting = screen.getByRole("button", { name: "Tente de novo em 1:30" });
        expect((waiting as HTMLButtonElement).disabled).toBe(true);

        act(() => {
          vi.advanceTimersByTime(91_000);
        });
        expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
        expect(api).toHaveBeenCalledTimes(1);
      });
    });

    it("does not persist the password nor the token in browser storage", async () => {
      const user = userEvent.setup({ delay: null });
      const setItem = vi.spyOn(Storage.prototype, "setItem");
      renderPage(LINK);
      await fillAndSubmit(user);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(config.doneTitle);
      expect(setItem).not.toHaveBeenCalled();
      expect(localStorage).toHaveLength(0);
      expect(sessionStorage).toHaveLength(0);
    });
  });
}
