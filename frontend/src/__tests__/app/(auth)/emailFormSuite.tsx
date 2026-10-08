import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ApiError } from "@/lib/api";

const EMAIL_LABEL = "E-mail";
const LOADING = "Enviando...";
const TYPED_EMAIL = "  Ana@Example.COM ";
const NORMALIZED_EMAIL = "ana@example.com";
const FALLBACK_MESSAGE = "Não foi possível processar sua solicitação. Tente novamente.";

type User = ReturnType<typeof userEvent.setup>;

export type EmailFormSuiteConfig = {
  page: ReactElement;
  api: Mock;
  resolvedValue: unknown;
  submit: string;
  neutralMessage: string;
};

function emailInput() {
  return screen.getByRole("textbox", { name: EMAIL_LABEL });
}

async function fillEmail(user: User, value = TYPED_EMAIL) {
  await user.click(emailInput());
  await user.paste(value);
}

function expectNeutralResult(neutralMessage: string) {
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Verifique seu e-mail");
  expect(screen.getByRole("alert").textContent).toBe(neutralMessage);
  expect(screen.getByRole("link", { name: "Voltar ao login" }).getAttribute("href")).toBe("/login");
  expect(screen.queryByRole("textbox", { name: EMAIL_LABEL })).toBeNull();
}

export function registerEmailFormTests(config: EmailFormSuiteConfig) {
  const { api, page, resolvedValue, neutralMessage } = config;

  function submitButton() {
    return screen.getByRole("button", { name: config.submit });
  }

  async function submitEmail(user: User, value = TYPED_EMAIL) {
    await fillEmail(user, value);
    await user.click(submitButton());
  }

  beforeEach(() => {
    api.mockResolvedValue(resolvedValue);
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "execCommand");
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("renders the request form with a way back to the login", () => {
    render(page);
    expect(screen.getByRole("link", { name: "Voltar ao login" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  describe("input handling", () => {
    it("strips emoji from the e-mail while typing", async () => {
      const user = userEvent.setup({ delay: null });
      render(page);
      await user.type(emailInput(), "a😀na@x.com");
      expect((emailInput() as HTMLInputElement).value).toBe("ana@x.com");
    });

    it("limits the e-mail to 254 characters", async () => {
      const user = userEvent.setup({ delay: null });
      render(page);
      await fillEmail(user, "a".repeat(300));
      expect((emailInput() as HTMLInputElement).value).toHaveLength(254);
    });

    it("replaces a pasted text that contains emoji with its clean version", async () => {
      const user = userEvent.setup({ delay: null });
      const execCommand = vi.fn();
      Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
      render(page);
      await fillEmail(user, "a😀@x.com");
      expect(execCommand).toHaveBeenCalledWith("insertText", false, "a@x.com");
    });
  });

  describe("validation", () => {
    it("asks for the e-mail and focuses it when it is empty", async () => {
      const user = userEvent.setup({ delay: null });
      render(page);
      await user.click(submitButton());
      expect(screen.getByRole("alert").textContent).toBe("Informe seu e-mail.");
      expect(document.activeElement).toBe(emailInput());
      expect(api).not.toHaveBeenCalled();
    });

    it("rejects a malformed e-mail without calling the API", async () => {
      const user = userEvent.setup({ delay: null });
      render(page);
      await submitEmail(user, "sem-arroba");
      expect(screen.getByRole("alert").textContent).toBe("Informe um e-mail válido.");
      expect(document.activeElement).toBe(emailInput());
      expect(api).not.toHaveBeenCalled();
    });

    it("clears the previous error as soon as the form is submitted again", async () => {
      const user = userEvent.setup({ delay: null });
      api.mockReturnValue(new Promise(() => undefined));
      render(page);
      await user.click(submitButton());
      expect(screen.getByRole("alert").textContent).toBe("Informe seu e-mail.");
      await submitEmail(user);
      expect(screen.getByRole("button", { name: LOADING })).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("submission", () => {
    it("sends the normalized e-mail and shows the neutral confirmation", async () => {
      const user = userEvent.setup({ delay: null });
      render(page);
      await submitEmail(user);
      expect(api).toHaveBeenCalledWith(NORMALIZED_EMAIL);
      expectNeutralResult(neutralMessage);
    });

    it("moves focus to the confirmation message", async () => {
      const user = userEvent.setup({ delay: null });
      render(page);
      await submitEmail(user);
      await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("alert")));
    });

    it("shows the busy state and locks the field while the request is in flight", async () => {
      const user = userEvent.setup({ delay: null });
      let finish: (value: unknown) => void = () => undefined;
      api.mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      render(page);
      await submitEmail(user);

      const button = screen.getByRole("button", { name: LOADING });
      expect((button as HTMLButtonElement).disabled).toBe(true);
      expect((emailInput() as HTMLInputElement).disabled).toBe(true);
      expect(button.closest("form")?.getAttribute("aria-busy")).toBe("true");

      await act(async () => finish(resolvedValue));
      expectNeutralResult(neutralMessage);
    });
  });

  describe("failures", () => {
    it.each([400, 404, 422])("shows the same neutral confirmation for a %i answer, hiding whether the account exists", async (status) => {
      const user = userEvent.setup({ delay: null });
      api.mockRejectedValue(new ApiError(status, "Server text"));
      render(page);
      await submitEmail(user);
      expectNeutralResult(neutralMessage);
    });

    it("keeps the form and explains a server failure", async () => {
      const user = userEvent.setup({ delay: null });
      api.mockRejectedValue(new ApiError(500, "Server text"));
      render(page);
      await submitEmail(user);

      const alert = screen.getByRole("alert");
      expect(alert.textContent).toBe(FALLBACK_MESSAGE);
      await waitFor(() => expect(document.activeElement).toBe(alert));
      expect((emailInput() as HTMLInputElement).value).toBe(TYPED_EMAIL.trim());
      expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
    });

    it("reports a connection problem when the request itself fails", async () => {
      const user = userEvent.setup({ delay: null });
      api.mockRejectedValue(new TypeError("Failed to fetch"));
      render(page);
      await submitEmail(user);
      expect(screen.getByRole("alert").textContent).toBe("Não foi possível conectar ao servidor. Tente novamente.");
    });

    it("does not treat rate limiting as a confirmation", async () => {
      const user = userEvent.setup({ delay: null });
      api.mockRejectedValue(new ApiError(429, "Too many"));
      render(page);
      await submitEmail(user);
      expect(screen.getByRole("alert").textContent).toBe("Muitas tentativas. Aguarde um instante e tente novamente.");
      expect(screen.queryByRole("heading", { name: "Verifique seu e-mail" })).toBeNull();
      expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
    });

    it("blocks the button with a countdown for the wait the server asked and releases it afterwards", async () => {
      api.mockRejectedValue(new ApiError(429, "Too many", undefined, 45));
      render(page);
      await fillEmail(userEvent.setup({ delay: null }));
      vi.useFakeTimers();
      fireEvent.click(submitButton());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(screen.getByRole("alert").textContent).toBe("Muitas tentativas. Aguarde 45 segundos e tente novamente.");
      const waiting = screen.getByRole("button", { name: "Tente de novo em 45 s" });
      expect((waiting as HTMLButtonElement).disabled).toBe(true);

      act(() => {
        vi.advanceTimersByTime(46_000);
      });
      expect((submitButton() as HTMLButtonElement).disabled).toBe(false);
      expect(api).toHaveBeenCalledTimes(1);
    });
  });

  it("does not persist anything in browser storage", async () => {
    const user = userEvent.setup({ delay: null });
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(page);
    await submitEmail(user);
    expectNeutralResult(neutralMessage);
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage).toHaveLength(0);
    expect(sessionStorage).toHaveLength(0);
  });
}
