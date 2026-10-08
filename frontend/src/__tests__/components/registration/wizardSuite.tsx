import type { ComponentType } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi, type Mock } from "vitest";
import { municipioCache } from "@/components/registration/location";
import { REVIEW_FOLD_MS } from "@/components/registration/ReviewStep";
import { ApiError } from "@/lib/api";
import {
  BACK,
  CEP_FIELD,
  CONTINUE,
  EDIT_PERSONAL,
  EMAIL_FIELD,
  NAME_FIELD,
  NETWORK_ERROR,
  PERSONAL,
  PERSONAL_HEADING,
  REVIEW_HEADING,
  SUBMITTING,
  SUBMIT_FALLBACK,
  SUBMIT_FORBIDDEN,
  SUBMIT_LABEL,
  SUCCESS_TITLE,
  acceptRequiredConsents,
  alertText,
  button,
  fill,
  fillContact,
  goToDetails,
  lgpdEssentialCheckbox,
  marketingCheckbox,
  seedMunicipios,
  stepHeading,
  summaryValue,
  termsCheckbox,
  textField,
} from "./wizardTestHelpers";

const SUCCESS_PAUSE_MS = 700;
const CEP_DEBOUNCE_MS = 400;
const STEP_ONE = "Etapa 1 de 3";
const INVALID_CITY_STATE = "A cidade informada não pertence ao estado selecionado.";
const CEP_VALUE = "36180-000";
const CEP_STATUS = "Cidade e UF preenchidas pelo CEP.";
const RATE_LIMIT_MESSAGE = "Muitas tentativas. Aguarde 30 segundos e tente novamente.";

type WizardSuiteConfig = {
  Wizard: ComponentType;
  /** The mocked `registrationApi` call that sends the request of this wizard. */
  api: Mock;
  /** The motion policy returned by the mocked `useMotionPolicy`. */
  motion: { policy: "reduced" | "pointer" };
  title: string;
  detailsHeading: RegExp;
  /** Fills the second step with the minimum valid data. */
  fillDetails: (user: UserEvent) => void | Promise<void>;
  /** A field of the second step whose value must survive going back to the first step. */
  keptField: { label: string; value: string };
};

export function registerWizardTests(config: WizardSuiteConfig) {
  const { Wizard, api, motion, title, detailsHeading, fillDetails, keptField } = config;

  async function goToReview(user: UserEvent) {
    await goToDetails(user, detailsHeading);
    await fillDetails(user);
    await user.click(button(CONTINUE));
    await stepHeading(REVIEW_HEADING);
  }

  async function submitFromReview(user: UserEvent) {
    await goToReview(user);
    await acceptRequiredConsents(user);
    await user.click(button(SUBMIT_LABEL));
  }

  beforeEach(() => {
    motion.policy = "reduced";
    api.mockReset().mockResolvedValue({});
    seedMunicipios();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("starts on the personal data step with the page title, links and no back button", () => {
    render(<Wizard />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(title);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(STEP_ONE);
    expect(screen.queryByRole("button", { name: BACK })).toBeNull();
    expect(screen.getByText("Os campos com * são obrigatórios.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar para escolher perfil" }).getAttribute("href")).toBe("/cadastro");
    expect(screen.getByRole("link", { name: "Entrar na plataforma" }).getAttribute("href")).toBe("/login");
    expect(button(CONTINUE).type).toBe("submit");
  });

  it("blocks advancing with the first error, focuses its field and drops the alert once it is edited", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Wizard />);

    await user.click(button(CONTINUE));

    expect(alertText()).toBe("Informe um nome válido, sem números.");
    expect(document.activeElement).toBe(textField(NAME_FIELD));
    expect(screen.getByText("Informe seu e-mail.")).toBeTruthy();
    expect(screen.getByText("Informe um telefone brasileiro válido.")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toContain(STEP_ONE);

    fill(NAME_FIELD, "Ana");

    expect(screen.queryByRole("alert")).toBeNull();
    expect(textField(NAME_FIELD).getAttribute("aria-invalid")).toBe("false");
    expect(textField(EMAIL_FIELD).getAttribute("aria-invalid")).toBe("true");
  });

  it("validates a field on blur without raising the alert", () => {
    render(<Wizard />);

    fireEvent.blur(textField(EMAIL_FIELD));

    expect(screen.getByText("Informe seu e-mail.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("focuses the CEP field when it is the first invalid one", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Wizard />);
    fillContact();
    fill(CEP_FIELD, "123");

    await user.click(button(CONTINUE));

    expect(alertText()).toBe("Informe um CEP válido com 8 dígitos.");
    expect(document.activeElement).toBe(textField(CEP_FIELD));
  });

  it("keeps what was typed when going back to a previous step", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Wizard />);
    await goToDetails(user, detailsHeading);
    fill(keptField.label, keptField.value);

    await user.click(button(BACK));
    await stepHeading(PERSONAL_HEADING);

    expect(textField(NAME_FIELD).value).toBe(PERSONAL.nameInput);
    expect(textField(EMAIL_FIELD).value).toBe(PERSONAL.emailInput);

    await user.click(button(CONTINUE));
    await stepHeading(detailsHeading);

    expect(textField(keptField.label).value).toBe(keptField.value);
  });

  it("keeps Enviar disabled until both required consents are checked, and the optional one never gates it", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Wizard />);
    await goToReview(user);

    expect(button(SUBMIT_LABEL).disabled).toBe(true);

    await user.click(termsCheckbox());
    expect(button(SUBMIT_LABEL).disabled).toBe(true);

    await user.click(lgpdEssentialCheckbox());
    expect(button(SUBMIT_LABEL).disabled).toBe(false);

    // The optional marketing consent never gates the button.
    await user.click(marketingCheckbox());
    expect((marketingCheckbox() as HTMLInputElement).checked).toBe(true);
    expect(button(SUBMIT_LABEL).disabled).toBe(false);

    // Unchecking a required consent disables Enviar again.
    await user.click(termsCheckbox());
    expect(button(SUBMIT_LABEL).disabled).toBe(true);
  });

  it("locks the form while the request is pending", async () => {
    const user = userEvent.setup({ delay: null });
    let finishRequest: () => void = () => undefined;
    api.mockReturnValue(new Promise<void>((resolve) => (finishRequest = resolve)));
    const { container } = render(<Wizard />);

    await submitFromReview(user);

    expect(container.querySelector("form")?.getAttribute("aria-busy")).toBe("true");
    expect(button(SUBMITTING).disabled).toBe(true);
    expect(button(BACK).disabled).toBe(true);
    expect(button(EDIT_PERSONAL).disabled).toBe(true);
    expect(screen.getByRole("checkbox", { name: /dados pessoais essenciais/i }).hasAttribute("disabled")).toBe(true);

    await act(async () => finishRequest());

    expect(await screen.findByRole("heading", { name: SUCCESS_TITLE })).toBeTruthy();
  });

  it.each<[string, unknown, string]>([
    ["a server error", new ApiError(500, "boom"), SUBMIT_FALLBACK],
    ["a forbidden response", new ApiError(403, "forbidden"), SUBMIT_FORBIDDEN],
    ["a rate limit", new ApiError(429, "slow down", undefined, 30), RATE_LIMIT_MESSAGE],
    ["a network failure", new TypeError("Failed to fetch"), NETWORK_ERROR],
  ])("shows a pt-BR message and unlocks the form after %s", async (_name, failure, message) => {
    const user = userEvent.setup({ delay: null });
    api.mockRejectedValueOnce(failure);
    render(<Wizard />);

    await submitFromReview(user);

    expect(await screen.findByText(message)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("alert"));
    expect(screen.queryByRole("heading", { name: SUCCESS_TITLE })).toBeNull();
    expect(button(SUBMIT_LABEL).disabled).toBe(false);
    expect(button(BACK).disabled).toBe(false);
  });

  it("lets the person submit again after a failure", async () => {
    const user = userEvent.setup({ delay: null });
    api.mockRejectedValueOnce(new ApiError(500, "boom"));
    render(<Wizard />);
    await submitFromReview(user);
    await screen.findByText(SUBMIT_FALLBACK);

    await user.click(button(SUBMIT_LABEL));

    expect(await screen.findByRole("heading", { name: SUCCESS_TITLE })).toBeTruthy();
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("revalidates every step on submit and returns to the one that became invalid", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Wizard />);
    await goToReview(user);
    await acceptRequiredConsents(user);
    municipioCache.set(PERSONAL.uf, [{ id: 1, nome: "Ubá" }]);

    await user.click(button(SUBMIT_LABEL));

    await stepHeading(PERSONAL_HEADING);
    expect(alertText()).toBe(INVALID_CITY_STATE);
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: /Cidade/ }));
    expect(api).not.toHaveBeenCalled();
  });

  it("fills city and state from the CEP and never sends the CEP", async () => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ localidade: PERSONAL.city, uf: PERSONAL.uf }) }),
    );
    render(<Wizard />);
    fillContact();

    vi.useFakeTimers();
    fill(CEP_FIELD, CEP_VALUE);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(CEP_DEBOUNCE_MS);
    });
    vi.useRealTimers();

    expect(screen.getByText(CEP_STATUS)).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /Estado/ }).textContent).toBe(PERSONAL.uf);
    expect((screen.getByRole("combobox", { name: /Cidade/ }) as HTMLInputElement).value).toBe(PERSONAL.city);

    await user.click(button(CONTINUE));
    await stepHeading(detailsHeading);
    await fillDetails(user);
    await user.click(button(CONTINUE));
    await stepHeading(REVIEW_HEADING);
    expect(summaryValue(CEP_FIELD)).toBe(CEP_VALUE);
    await acceptRequiredConsents(user);
    await user.click(button(SUBMIT_LABEL));

    await screen.findByRole("heading", { name: SUCCESS_TITLE });
    const sent = api.mock.calls.at(-1)?.[0];
    expect(sent).toMatchObject({ cidade: PERSONAL.city, uf: PERSONAL.uf });
    expect(sent).not.toHaveProperty("cep");
  });

  it("folds the summary before sending and draws the check before the confirmation", async () => {
    const user = userEvent.setup({ delay: null });
    motion.policy = "pointer";
    render(<Wizard />);
    await goToReview(user);
    await acceptRequiredConsents(user);

    vi.useFakeTimers();
    fireEvent.click(button(SUBMIT_LABEL));
    expect(button(SUBMITTING).disabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REVIEW_FOLD_MS - 1);
    });
    expect(api).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(api).toHaveBeenCalledTimes(1);
    expect(button(SUBMITTING).type).toBe("button");
    expect(screen.queryByRole("heading", { name: SUCCESS_TITLE })).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SUCCESS_PAUSE_MS);
    });
    expect(screen.getByRole("heading", { name: SUCCESS_TITLE })).toBeTruthy();
  });
}
