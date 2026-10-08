import { fireEvent, render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StudentRegistrationWizard } from "@/components/registration/StudentRegistrationWizard";
import {
  CONTINUE,
  EDIT_PERSONAL,
  NAME_FIELD,
  NOT_INFORMED,
  PERSONAL,
  PERSONAL_HEADING,
  REVIEW_HEADING,
  SUBMIT_LABEL,
  SUCCESS_TITLE,
  acceptTerms,
  alertText,
  button,
  fill,
  goToDetails,
  selectOption,
  stepHeading,
  summaryValue,
  textField,
} from "./wizardTestHelpers";
import { registerWizardTests } from "./wizardSuite";

vi.setConfig({ testTimeout: 15_000 });

const api = vi.hoisted(() => ({ student: vi.fn() }));
const motion = vi.hoisted(() => ({ policy: "reduced" as "reduced" | "pointer" }));

vi.mock("@/lib/admin", () => ({ registrationApi: { student: api.student } }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => motion.policy }));

const EDUCATION_HEADING = /Formação acadêmica/;
const INSTITUTION = "Instituto Federal  Sudeste MG ";
const COURSE = "Ciência da Computação";
const INSTITUTION_FIELD = "Instituição de ensino";
const COURSE_FIELD = "Curso";
const YEAR_FIELD = "Ano previsto de conclusão";
const RELATION_FIELD = "Relação com o Rio Pomba Valley";
const FORMATION_FIELD = /Tipo de formação/;
const RELATION = "  Moro em Rio Pomba desde 2010  ";
const EDIT_EDUCATION = "Editar formação acadêmica";

const nextYear = String(new Date().getFullYear() + 1);

type Optional = { year: string; relation: string };

async function fillEducation(user: UserEvent, optional?: Optional) {
  fill(INSTITUTION_FIELD, INSTITUTION);
  fill(COURSE_FIELD, COURSE);
  await selectOption(user, FORMATION_FIELD, "Graduação");
  if (optional) {
    fill(YEAR_FIELD, optional.year);
    fill(RELATION_FIELD, optional.relation);
  }
}

async function goToReview(user: UserEvent, optional?: Optional) {
  await goToDetails(user, EDUCATION_HEADING);
  await fillEducation(user, optional);
  await user.click(button(CONTINUE));
  await stepHeading(REVIEW_HEADING);
}

describe("StudentRegistrationWizard", () => {
  registerWizardTests({
    Wizard: StudentRegistrationWizard,
    api: api.student,
    motion,
    title: "Solicitar acesso como aluno",
    detailsHeading: EDUCATION_HEADING,
    fillDetails: (user) => fillEducation(user),
    keptField: { label: INSTITUTION_FIELD, value: INSTITUTION },
  });

  it("reports the first invalid education field and focuses it", async () => {
    const user = userEvent.setup({ delay: null });
    render(<StudentRegistrationWizard />);
    await goToDetails(user, EDUCATION_HEADING);

    await user.click(button(CONTINUE));

    expect(alertText()).toBe("Informe uma instituição válido.");
    expect(document.activeElement).toBe(textField(INSTITUTION_FIELD));
    expect(screen.getByText("Informe um curso válido.")).toBeTruthy();
    expect(screen.getByText("Selecione um tipo de formação válido.")).toBeTruthy();
  });

  it("focuses the formation select when only the formation type is missing", async () => {
    const user = userEvent.setup({ delay: null });
    render(<StudentRegistrationWizard />);
    await goToDetails(user, EDUCATION_HEADING);
    fill(INSTITUTION_FIELD, INSTITUTION);
    fill(COURSE_FIELD, COURSE);

    await user.click(button(CONTINUE));

    expect(alertText()).toBe("Selecione um tipo de formação válido.");
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: FORMATION_FIELD }));
  });

  it("rejects an expected conclusion year out of range and validates education fields on blur", async () => {
    const user = userEvent.setup({ delay: null });
    render(<StudentRegistrationWizard />);
    await goToDetails(user, EDUCATION_HEADING);
    await fillEducation(user, { year: "1800", relation: "" });

    await user.click(button(CONTINUE));

    expect(alertText()).toContain("Informe um ano entre 1900 e");
    expect(document.activeElement).toBe(textField(YEAR_FIELD));

    fill(COURSE_FIELD, "");
    fireEvent.blur(textField(COURSE_FIELD));

    expect(screen.getByText("Informe um curso válido.")).toBeTruthy();
  });

  it("summarizes the data on review and lets each card jump back to its step", async () => {
    const user = userEvent.setup({ delay: null });
    render(<StudentRegistrationWizard />);
    await goToReview(user, { year: nextYear, relation: RELATION });

    expect(summaryValue(NAME_FIELD)).toBe(PERSONAL.name);
    expect(summaryValue("E-mail")).toBe(PERSONAL.emailInput);
    expect(summaryValue("Cidade e estado")).toBe(`${PERSONAL.city} - ${PERSONAL.uf}`);
    expect(summaryValue(INSTITUTION_FIELD)).toBe("Instituto Federal Sudeste MG");
    expect(summaryValue("Tipo de formação")).toBe("Graduação");
    expect(summaryValue(YEAR_FIELD)).toBe(nextYear);
    expect(summaryValue(RELATION_FIELD)).toBe(RELATION.trim());
    expect(screen.getAllByText(NOT_INFORMED)).toHaveLength(1);
    expect(screen.queryByText("Os campos com * são obrigatórios.")).toBeNull();
    expect(button(SUBMIT_LABEL).type).toBe("submit");

    await user.click(button(EDIT_EDUCATION));
    await stepHeading(EDUCATION_HEADING);
    expect(textField(COURSE_FIELD).value).toBe(COURSE);

    await user.click(button(CONTINUE));
    await stepHeading(REVIEW_HEADING);
    await user.click(button(EDIT_PERSONAL));
    await stepHeading(PERSONAL_HEADING);
    expect(textField(NAME_FIELD).value).toBe(PERSONAL.nameInput);
  });

  it("marks empty optional values as not informed on review", async () => {
    const user = userEvent.setup({ delay: null });
    render(<StudentRegistrationWizard />);
    await goToReview(user);

    expect(screen.getAllByText(NOT_INFORMED)).toHaveLength(3);
  });

  it("sends the normalized request without the CEP and then shows the confirmation", async () => {
    const user = userEvent.setup({ delay: null });
    render(<StudentRegistrationWizard />);
    await goToReview(user, { year: nextYear, relation: RELATION });
    await acceptTerms(user);

    await user.click(button(SUBMIT_LABEL));

    expect(await screen.findByRole("heading", { name: SUCCESS_TITLE })).toBeTruthy();
    expect(api.student).toHaveBeenCalledTimes(1);
    expect(api.student).toHaveBeenCalledWith({
      nomeCompleto: PERSONAL.name,
      email: PERSONAL.email,
      telefone: PERSONAL.phone,
      cidade: PERSONAL.city,
      uf: PERSONAL.uf,
      instituicaoEnsino: "Instituto Federal Sudeste MG",
      curso: COURSE,
      tipoFormacao: "GRADUACAO",
      anoConclusaoPrevisto: Number(nextYear),
      relacaoRioPombaValley: RELATION.trim(),
      consentTermos: true,
    });
    expect(screen.queryByRole("button", { name: SUBMIT_LABEL })).toBeNull();
    expect(screen.getByRole("link", { name: "Voltar à página inicial" }).getAttribute("href")).toBe("/");
  });

  it("sends null for the optional fields left blank", async () => {
    const user = userEvent.setup({ delay: null });
    render(<StudentRegistrationWizard />);
    await goToReview(user);
    await acceptTerms(user);

    await user.click(button(SUBMIT_LABEL));

    await screen.findByRole("heading", { name: SUCCESS_TITLE });
    expect(api.student).toHaveBeenCalledWith(
      expect.objectContaining({ anoConclusaoPrevisto: null, relacaoRioPombaValley: null }),
    );
  });
});
