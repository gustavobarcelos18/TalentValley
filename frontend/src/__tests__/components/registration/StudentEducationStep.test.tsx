import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  StudentEducationStep,
  studentEducationBlank,
  type StudentEducationForm,
} from "@/components/registration/StudentEducationStep";
import { TIPO_FORMACAO_LABELS } from "@/lib/labels";
import { EMOJI, createStepHandlers, field, useExecCommandSpy } from "./stepTestHelpers";

vi.setConfig({ testTimeout: 15_000 });

const INSTITUTION = "Instituição de ensino";
const COURSE = "Curso";
const YEAR = "Ano previsto de conclusão";
const RELATION = "Relação com o Rio Pomba Valley";
const FORMATION = /Tipo de formação/;
const YEAR_HINT = "Opcional; use quatro dígitos.";
const RELATION_HINT = "Opcional; compartilhe seu vínculo com a comunidade.";

const handlers = createStepHandlers();

function stepElement(value: Partial<StudentEducationForm> = {}, props: { errors?: Record<string, string | null>; disabled?: boolean } = {}) {
  return (
    <StudentEducationStep
      value={{ ...studentEducationBlank, ...value }}
      errors={props.errors ?? {}}
      onChange={handlers.onChange}
      onBlur={handlers.onBlur}
      registerFieldRef={handlers.registerFieldRef}
      disabled={props.disabled ?? false}
    />
  );
}

function renderStep(props: { value?: Partial<StudentEducationForm>; errors?: Record<string, string | null>; disabled?: boolean } = {}) {
  const view = render(stepElement(props.value, props));
  return { ...view, rerenderValue: (value: Partial<StudentEducationForm>) => view.rerender(stepElement(value, props)) };
}

function formationSelect() {
  return screen.getByRole("combobox", { name: FORMATION });
}

describe("StudentEducationStep", () => {
  const execCommand = useExecCommandSpy();

  beforeEach(handlers.reset);

  it("renders every text field empty by default", () => {
    renderStep();

    for (const label of [INSTITUTION, COURSE, YEAR, RELATION]) expect(field(label).value).toBe("");
  });

  it("shows the current values and marks only the optional fields as optional", () => {
    renderStep({
      value: { instituicaoEnsino: "IF Sudeste MG", curso: "Sistemas", anoConclusaoPrevisto: "2027", relacaoRioPombaValley: "Estagiário" },
    });

    expect(field(INSTITUTION).value).toBe("IF Sudeste MG");
    expect(field(COURSE).value).toBe("Sistemas");
    expect(field(YEAR).value).toBe("2027");
    expect(field(RELATION).value).toBe("Estagiário");
    expect(field(INSTITUTION).required).toBe(true);
    expect(field(COURSE).required).toBe(true);
    expect(field(YEAR).required).toBe(false);
    expect(field(RELATION).required).toBe(false);
  });

  it.each([
    { label: INSTITUTION, key: "instituicaoEnsino", limit: 180 },
    { label: COURSE, key: "curso", limit: 180 },
    { label: RELATION, key: "relacaoRioPombaValley", limit: 500 },
  ])("reports $key without emoji and capped at $limit characters", ({ label, key, limit }) => {
    renderStep();

    fireEvent.change(field(label), { target: { value: `a${EMOJI}b` } });
    expect(handlers.onChange).toHaveBeenLastCalledWith(key, "ab");

    fireEvent.change(field(label), { target: { value: "x".repeat(limit + 10) } });
    expect(handlers.onChange).toHaveBeenLastCalledWith(key, "x".repeat(limit));
  });

  it("keeps only up to four digits of the expected conclusion year", () => {
    renderStep();

    fireEvent.change(field(YEAR), { target: { value: "20a2-71" } });

    expect(handlers.onChange).toHaveBeenLastCalledWith("anoConclusaoPrevisto", "2027");
    expect(field(YEAR).getAttribute("inputmode")).toBe("numeric");
    expect(field(YEAR).maxLength).toBe(4);
  });

  it.each([
    { label: INSTITUTION, key: "instituicaoEnsino" },
    { label: COURSE, key: "curso" },
    { label: YEAR, key: "anoConclusaoPrevisto" },
    { label: RELATION, key: "relacaoRioPombaValley" },
  ])("reports the blur of $key", ({ label, key }) => {
    renderStep();

    fireEvent.blur(field(label));

    expect(handlers.onBlur).toHaveBeenCalledExactlyOnceWith(key);
  });

  it("offers every formation type and reports the chosen one", async () => {
    const user = userEvent.setup({ delay: null });
    renderStep();

    await user.click(formationSelect());
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(Object.values(TIPO_FORMACAO_LABELS));

    await user.click(screen.getByRole("option", { name: TIPO_FORMACAO_LABELS.GRADUACAO }));

    expect(handlers.onChange).toHaveBeenCalledExactlyOnceWith("tipoFormacao", "GRADUACAO");
  });

  it("shows the selected formation and reports the select blur", () => {
    renderStep({ value: { tipoFormacao: "TECNICO" } });

    expect(formationSelect().textContent).toBe(TIPO_FORMACAO_LABELS.TECNICO);

    fireEvent.blur(formationSelect());
    expect(handlers.onBlur).toHaveBeenCalledWith("tipoFormacao");
  });

  it("registers each control under its field key", () => {
    renderStep();

    expect([...handlers.refs.keys()]).toEqual(
      expect.arrayContaining(["instituicaoEnsino", "curso", "tipoFormacao", "anoConclusaoPrevisto", "relacaoRioPombaValley"]),
    );
    expect(handlers.refs.get("instituicaoEnsino")).toHaveBeenCalledWith(field(INSTITUTION));
    expect(handlers.refs.get("curso")).toHaveBeenCalledWith(field(COURSE));
    expect(handlers.refs.get("anoConclusaoPrevisto")).toHaveBeenCalledWith(field(YEAR));
    expect(handlers.refs.get("relacaoRioPombaValley")).toHaveBeenCalledWith(field(RELATION));
    expect(handlers.refs.get("tipoFormacao")).toHaveBeenCalledWith(expect.objectContaining({ focus: expect.any(Function) }));
  });

  it("removes emoji from pasted text", () => {
    renderStep();

    const accepted = fireEvent.paste(field(COURSE), { clipboardData: { getData: () => `Sistemas${EMOJI}` } });

    expect(accepted).toBe(false);
    expect(execCommand).toHaveBeenCalledWith("insertText", false, "Sistemas");
  });

  it("counts the characters of the relation text against its 500 limit", () => {
    const { rerenderValue } = renderStep();
    expect(screen.getByText("0 / 500")).toBeTruthy();

    rerenderValue({ relacaoRioPombaValley: "Ex-aluno" });

    expect(screen.getByText("8 / 500")).toBeTruthy();
  });

  it("explains the optional fields while they have no error", () => {
    renderStep();

    expect(screen.getByText(YEAR_HINT)).toBeTruthy();
    expect(screen.getByText(RELATION_HINT)).toBeTruthy();
  });

  it("shows validation errors in place of the hints and flags the fields invalid", () => {
    renderStep({
      errors: {
        instituicaoEnsino: "Informe a instituição.",
        curso: "Informe o curso.",
        tipoFormacao: "Selecione o tipo.",
        anoConclusaoPrevisto: "Ano inválido.",
        relacaoRioPombaValley: "Texto longo demais.",
      },
    });

    for (const message of ["Informe a instituição.", "Informe o curso.", "Selecione o tipo.", "Ano inválido.", "Texto longo demais."]) {
      expect(screen.getByText(message)).toBeTruthy();
    }
    expect(screen.queryByText(YEAR_HINT)).toBeNull();
    expect(screen.queryByText(RELATION_HINT)).toBeNull();
    for (const label of [INSTITUTION, COURSE, YEAR, RELATION]) expect(field(label).getAttribute("aria-invalid")).toBe("true");
    expect(formationSelect().getAttribute("aria-invalid")).toBe("true");
  });

  it("disables every field", () => {
    renderStep({ disabled: true });

    for (const label of [INSTITUTION, COURSE, YEAR, RELATION]) expect(field(label).disabled).toBe(true);
    expect(formationSelect().getAttribute("aria-disabled")).toBe("true");
  });
});
