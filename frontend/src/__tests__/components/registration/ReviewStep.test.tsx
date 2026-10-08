import type { ComponentProps } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMotionMedia } from "@/__tests__/components/auth/motion/motionMedia";
import { ReviewStep } from "@/components/registration/ReviewStep";
import type { CommonForm } from "@/components/registration/registrationForm";
import { LGPD_CONSENT_ERROR, CONSENT_ERROR, lgpdEssentialCheckbox, marketingCheckbox, termsCheckbox } from "./wizardTestHelpers";

vi.setConfig({ testTimeout: 15_000 });

const NOT_INFORMED = "Não informado";
const PERSONAL_TITLE = "Dados pessoais";
const EDIT_PERSONAL = "Editar dados pessoais";
const DETAILS_TITLE = "Formação";
const EDIT_DETAILS = "Editar formação";
const FOLDED_CARD = "translateY(-12px) scale(0.97)";
const UNFOLDED_CARD = "translateY(0px) scale(1)";

const personal: CommonForm = {
  nomeCompleto: "Ana Souza",
  email: "ana@exemplo.com",
  telefone: "(32) 99999-9999",
  cep: "36700-000",
  cidade: "Rio Pomba",
  uf: "MG",
};

const details = {
  title: DETAILS_TITLE,
  editLabel: EDIT_DETAILS,
  rows: [
    { label: "Curso", value: "Sistemas" },
    { label: "Ano previsto", value: "" },
  ],
};

type StepProps = Partial<ComponentProps<typeof ReviewStep>>;

function createHandlers() {
  return {
    onConsentTermosChange: vi.fn(),
    onConsentLgpdEssencialChange: vi.fn(),
    onConsentComunicacoesChange: vi.fn(),
    onEditStep: vi.fn(),
    registerFieldRef: vi.fn(() => vi.fn()),
  };
}

function stepElement(props: StepProps, handlers: ReturnType<typeof createHandlers>) {
  return (
    <ReviewStep
      personal={personal}
      details={details}
      consentTermos={false}
      consentTermosError={null}
      consentLgpdEssencial={false}
      consentLgpdError={null}
      consentComunicacoes={false}
      disabled={false}
      collapsed={false}
      {...handlers}
      {...props}
    />
  );
}

function renderStep(props: StepProps = {}) {
  const handlers = createHandlers();
  const view = render(stepElement(props, handlers));
  return { ...view, ...handlers, rerenderStep: (next: StepProps) => view.rerender(stepElement(next, handlers)) };
}

function summary(title: string) {
  return screen.getByRole("heading", { level: 3, name: title }).closest("section") as HTMLElement;
}

function foldContainer() {
  return summary(PERSONAL_TITLE).closest("[style*='overflow']") as HTMLElement;
}

function personalCard() {
  return summary(PERSONAL_TITLE).parentElement as HTMLElement;
}

describe("ReviewStep", () => {
  beforeEach(() => {
    stubMotionMedia("pointer");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("summarizes the personal data, with the city and state in one row", () => {
    renderStep();

    const card = within(summary(PERSONAL_TITLE));
    expect(card.getByText("Nome completo:").nextElementSibling?.textContent).toBe("Ana Souza");
    expect(card.getByText("E-mail:").nextElementSibling?.textContent).toBe("ana@exemplo.com");
    expect(card.getByText("Telefone:").nextElementSibling?.textContent).toBe("(32) 99999-9999");
    expect(card.getByText("CEP:").nextElementSibling?.textContent).toBe("36700-000");
    expect(card.getByText("Cidade e estado:").nextElementSibling?.textContent).toBe("Rio Pomba - MG");
  });

  it("summarizes the profile-specific rows and shows a placeholder for empty values", () => {
    renderStep({ personal: { ...personal, cep: "" } });

    expect(within(summary(PERSONAL_TITLE)).getByText("CEP:").nextElementSibling?.textContent).toBe(NOT_INFORMED);
    const card = within(summary(DETAILS_TITLE));
    expect(card.getByText("Curso:").nextElementSibling?.textContent).toBe("Sistemas");
    expect(card.getByText("Ano previsto:").nextElementSibling?.textContent).toBe(NOT_INFORMED);
  });

  it("sends the person back to the step that holds each summary", async () => {
    const user = userEvent.setup({ delay: null });
    const { onEditStep } = renderStep();

    await user.click(screen.getByRole("button", { name: EDIT_PERSONAL }));
    expect(onEditStep).toHaveBeenLastCalledWith(0);

    await user.click(screen.getByRole("button", { name: EDIT_DETAILS }));
    expect(onEditStep).toHaveBeenLastCalledWith(1);
    expect(onEditStep).toHaveBeenCalledTimes(2);
  });

  it("disables the edit buttons and the consents while disabled", () => {
    renderStep({ disabled: true });

    expect((screen.getByRole("button", { name: EDIT_PERSONAL }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: EDIT_DETAILS }) as HTMLButtonElement).disabled).toBe(true);
    expect((termsCheckbox() as HTMLInputElement).disabled).toBe(true);
    expect((lgpdEssentialCheckbox() as HTMLInputElement).disabled).toBe(true);
    expect((marketingCheckbox() as HTMLInputElement).disabled).toBe(true);
  });

  it("reports each consent change to its own handler", async () => {
    const user = userEvent.setup({ delay: null });
    const { onConsentTermosChange, onConsentLgpdEssencialChange, onConsentComunicacoesChange } = renderStep();

    await user.click(termsCheckbox());
    expect(onConsentTermosChange).toHaveBeenCalledExactlyOnceWith(true);

    await user.click(lgpdEssentialCheckbox());
    expect(onConsentLgpdEssencialChange).toHaveBeenCalledExactlyOnceWith(true);

    await user.click(marketingCheckbox());
    expect(onConsentComunicacoesChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it("keeps the three consents independent, so checking one does not affect the others", async () => {
    const user = userEvent.setup({ delay: null });
    const { onConsentTermosChange, onConsentLgpdEssencialChange, onConsentComunicacoesChange } = renderStep();

    await user.click(termsCheckbox());

    expect(onConsentTermosChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(onConsentLgpdEssencialChange).not.toHaveBeenCalled();
    expect(onConsentComunicacoesChange).not.toHaveBeenCalled();
  });

  it("reflects each checked consent and its error", () => {
    renderStep({
      consentTermos: true,
      consentTermosError: CONSENT_ERROR,
      consentLgpdEssencial: true,
      consentLgpdError: LGPD_CONSENT_ERROR,
      consentComunicacoes: true,
    });

    expect((termsCheckbox() as HTMLInputElement).checked).toBe(true);
    expect((lgpdEssentialCheckbox() as HTMLInputElement).checked).toBe(true);
    expect((marketingCheckbox() as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(CONSENT_ERROR)).toBeTruthy();
    expect(screen.getByText(LGPD_CONSENT_ERROR)).toBeTruthy();
  });

  it("registers each mandatory consent input under its own key", () => {
    const { registerFieldRef } = renderStep();

    expect(registerFieldRef).toHaveBeenCalledWith("consentTermos");
    expect(registerFieldRef).toHaveBeenCalledWith("consentLgpdEssencial");
  });

  it("keeps the summary reachable while it is not folded", () => {
    renderStep({ collapsed: false });

    expect(foldContainer().hasAttribute("inert")).toBe(false);
    expect(foldContainer().style.height).toBe("auto");
    expect(personalCard().style.transform).toBe(UNFOLDED_CARD);
  });

  it("folds the summary away from the tab order and the accessibility tree, keeping the consents", () => {
    renderStep({ collapsed: true });

    expect(foldContainer().hasAttribute("inert")).toBe(true);
    expect(foldContainer().style.height).toBe("0px");
    expect(termsCheckbox()).toBeTruthy();
    expect(lgpdEssentialCheckbox()).toBeTruthy();
    expect(marketingCheckbox()).toBeTruthy();
  });

  it.each(["pointer", "touch"] as const)("lifts and shrinks the folded cards when the motion policy is %s", (policy) => {
    vi.unstubAllGlobals();
    stubMotionMedia(policy);

    renderStep({ collapsed: true });

    expect(personalCard().style.transform).toBe(FOLDED_CARD);
  });

  it("only fades the folded cards when motion is reduced", () => {
    vi.unstubAllGlobals();
    stubMotionMedia("reduced");

    renderStep({ collapsed: true });

    expect(personalCard().style.transform).toBe(UNFOLDED_CARD);
    expect(personalCard().style.opacity).toBe("0");
  });

  it("unfolds the summary again when the request fails", () => {
    const { rerenderStep } = renderStep({ collapsed: true });
    expect(foldContainer().hasAttribute("inert")).toBe(true);

    rerenderStep({ collapsed: false });

    expect(foldContainer().hasAttribute("inert")).toBe(false);
  });
});
