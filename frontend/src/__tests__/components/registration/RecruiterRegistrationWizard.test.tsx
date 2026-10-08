import { fireEvent, render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecruiterRegistrationWizard } from "@/components/registration/RecruiterRegistrationWizard";
import {
  CEP_FIELD,
  CONTINUE,
  EDIT_PERSONAL,
  NAME_FIELD,
  NOT_INFORMED,
  PERSONAL,
  PERSONAL_HEADING,
  REVIEW_HEADING,
  SUBMIT_LABEL,
  SUCCESS_TITLE,
  acceptRequiredConsents,
  alertText,
  button,
  fill,
  goToDetails,
  stepHeading,
  summaryValue,
  textField,
} from "./wizardTestHelpers";
import { registerWizardTests } from "./wizardSuite";

vi.setConfig({ testTimeout: 15_000 });

const api = vi.hoisted(() => ({ recruiter: vi.fn() }));
const motion = vi.hoisted(() => ({ policy: "reduced" as "reduced" | "pointer" }));

vi.mock("@/lib/admin", () => ({ registrationApi: { recruiter: api.recruiter } }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => motion.policy }));

const COMPANY_HEADING = /Dados da empresa/;
const COMPANY_FIELD = "Empresa";
const ROLE_FIELD = "Cargo";
const SITE_FIELD = "Site da empresa";
const COMPANY = "  Talent   Valley Ltda ";
const ROLE = " Analista  de RH ";
const SITE = "  https://talentvalley.example.com/vagas  ";
const EDIT_COMPANY = "Editar dados da empresa";

function fillCompany(site = "") {
  fill(COMPANY_FIELD, COMPANY);
  fill(ROLE_FIELD, ROLE);
  if (site) fill(SITE_FIELD, site);
}

async function goToReview(user: UserEvent, site = "") {
  await goToDetails(user, COMPANY_HEADING);
  fillCompany(site);
  await user.click(button(CONTINUE));
  await stepHeading(REVIEW_HEADING);
}

describe("RecruiterRegistrationWizard", () => {
  registerWizardTests({
    Wizard: RecruiterRegistrationWizard,
    api: api.recruiter,
    motion,
    title: "Solicitar acesso como recrutador",
    detailsHeading: COMPANY_HEADING,
    fillDetails: () => fillCompany(),
    keptField: { label: COMPANY_FIELD, value: COMPANY },
  });

  it("reports the first invalid company field, focuses it and validates company fields on blur", async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterRegistrationWizard />);
    await goToDetails(user, COMPANY_HEADING);

    await user.click(button(CONTINUE));

    expect(alertText()).toBe("Informe uma empresa válido.");
    expect(document.activeElement).toBe(textField(COMPANY_FIELD));
    expect(screen.getByText("Informe um cargo válido.")).toBeTruthy();

    fill(ROLE_FIELD, "");
    fireEvent.blur(textField(ROLE_FIELD));

    expect(textField(ROLE_FIELD).getAttribute("aria-invalid")).toBe("true");
  });

  it.each<[string, string, string]>([
    ["a scheme other than HTTP or HTTPS", "ftp://talentvalley.example.com", "Informe uma URL começando com http:// ou https://."],
    ["a value with spaces", "talent valley", "Informe uma URL válida."],
  ])("rejects a company site with %s and focuses it", async (_name, site, message) => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterRegistrationWizard />);
    await goToDetails(user, COMPANY_HEADING);
    fillCompany(site);

    await user.click(button(CONTINUE));

    expect(alertText()).toBe(message);
    expect(document.activeElement).toBe(textField(SITE_FIELD));
  });

  it("summarizes the data on review and lets each card jump back to its step", async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterRegistrationWizard />);
    await goToReview(user, SITE);

    expect(summaryValue(NAME_FIELD)).toBe(PERSONAL.name);
    expect(summaryValue("E-mail")).toBe(PERSONAL.emailInput);
    expect(summaryValue("Cidade e estado")).toBe(`${PERSONAL.city} - ${PERSONAL.uf}`);
    expect(summaryValue(COMPANY_FIELD)).toBe("Talent Valley Ltda");
    expect(summaryValue(ROLE_FIELD)).toBe("Analista de RH");
    expect(summaryValue(SITE_FIELD)).toBe(SITE.trim());
    expect(summaryValue(CEP_FIELD)).toBe(NOT_INFORMED);
    expect(screen.queryByText("Os campos com * são obrigatórios.")).toBeNull();
    expect(button(SUBMIT_LABEL).type).toBe("submit");

    await user.click(button(EDIT_COMPANY));
    await stepHeading(COMPANY_HEADING);
    expect(textField(ROLE_FIELD).value).toBe(ROLE);

    await user.click(button(CONTINUE));
    await stepHeading(REVIEW_HEADING);
    await user.click(button(EDIT_PERSONAL));
    await stepHeading(PERSONAL_HEADING);
    expect(textField(NAME_FIELD).value).toBe(PERSONAL.nameInput);
  });

  it("marks an empty company site as not informed on review", async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterRegistrationWizard />);
    await goToReview(user);

    expect(summaryValue(SITE_FIELD)).toBe(NOT_INFORMED);
  });

  it("sends the normalized request without the CEP and then shows the confirmation", async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterRegistrationWizard />);
    await goToReview(user, SITE);
    await acceptRequiredConsents(user);

    await user.click(button(SUBMIT_LABEL));

    expect(await screen.findByRole("heading", { name: SUCCESS_TITLE })).toBeTruthy();
    expect(api.recruiter).toHaveBeenCalledTimes(1);
    expect(api.recruiter).toHaveBeenCalledWith({
      nomeCompleto: PERSONAL.name,
      email: PERSONAL.email,
      telefone: PERSONAL.phone,
      cidade: PERSONAL.city,
      uf: PERSONAL.uf,
      empresa: "Talent Valley Ltda",
      cargo: "Analista de RH",
      siteEmpresa: SITE.trim(),
      consentTermos: true,
    });
    expect(screen.queryByRole("button", { name: SUBMIT_LABEL })).toBeNull();
    expect(screen.getByRole("link", { name: "Voltar à página inicial" }).getAttribute("href")).toBe("/");
  });

  it("sends a null site when it is left blank", async () => {
    const user = userEvent.setup({ delay: null });
    render(<RecruiterRegistrationWizard />);
    await goToReview(user);
    await acceptRequiredConsents(user);

    await user.click(button(SUBMIT_LABEL));

    await screen.findByRole("heading", { name: SUCCESS_TITLE });
    expect(api.recruiter).toHaveBeenCalledWith(expect.objectContaining({ siteEmpresa: null }));
  });
});
