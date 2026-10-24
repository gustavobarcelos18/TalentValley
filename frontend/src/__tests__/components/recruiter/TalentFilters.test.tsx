import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TalentFilters } from "@/components/recruiter/TalentFilters";
import type { CatalogoCompetenciaResponse } from "@/types/student";
import type { TalentSearchFilters } from "@/types/recruiter";
import { useExecCommandSpy } from "../registration/stepTestHelpers";
import { makeFilters } from "./recruiterDiscoveryFixtures";

vi.setConfig({ testTimeout: 15_000 });

const COMPETENCIES: CatalogoCompetenciaResponse[] = [
  { id: 1, nome: "React", categoria: "Tecnologia · Frontend", tipo: "TECNICA" },
  { id: 2, nome: "Python", categoria: "Tecnologia · Linguagens", tipo: "TECNICA" },
  { id: 3, nome: "SQL", categoria: "Tecnologia · Linguagens", tipo: "TECNICA" },
  { id: 4, nome: "Liderança", categoria: "Liderança e colaboração", tipo: "COMPORTAMENTAL" },
];
const INVALID_SEARCH = "Informe uma busca válida.";
const INVALID_UF = "Selecione uma UF válida.";
const EMOJI = "😀";

interface Setup {
  onChange: ReturnType<typeof vi.fn<(value: TalentSearchFilters) => void>>;
  onApply: ReturnType<typeof vi.fn<() => void>>;
  onClear: ReturnType<typeof vi.fn<() => void>>;
  retryCatalog: ReturnType<typeof vi.fn<() => void>>;
}

// Controlled wrapper that keeps the filters in state, like the discovery view does with its draft.
function Harness({ initial, catalogError, setup }: { initial: TalentSearchFilters; catalogError: string | null; setup: Setup }) {
  const [value, setValue] = useState(initial);
  return (
    <TalentFilters
      value={value}
      onChange={(next) => {
        setup.onChange(next);
        setValue(next);
      }}
      onApply={setup.onApply}
      onClear={setup.onClear}
      competencies={COMPETENCIES}
      catalogError={catalogError}
      retryCatalog={setup.retryCatalog}
    />
  );
}

function renderFilters(initial: Partial<TalentSearchFilters> = {}, catalogError: string | null = null): Setup {
  const setup: Setup = { onChange: vi.fn(), onApply: vi.fn(), onClear: vi.fn(), retryCatalog: vi.fn() };
  render(<Harness initial={makeFilters(initial)} catalogError={catalogError} setup={setup} />);
  return setup;
}

function lastChange(setup: Setup): TalentSearchFilters {
  const calls = setup.onChange.mock.calls;
  return calls[calls.length - 1][0];
}

function ufSelect() {
  return screen.getByRole("combobox", { name: "UF" });
}

async function chooseUf(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(ufSelect());
  await user.click(await screen.findByRole("option", { name: option }));
}

function group(name: string) {
  return within(screen.getByRole("group", { name }));
}

describe("TalentFilters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("shows the text criteria with the current values", () => {
      renderFilters({ nome: "Maria", cidade: "Rio Pomba", uf: "MG", formacaoNome: "Sistemas" });
      expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Maria");
      expect((screen.getByLabelText("Cidade") as HTMLInputElement).value).toBe("Rio Pomba");
      expect(ufSelect().textContent).toBe("MG");
      expect((screen.getByLabelText("Nome da formação") as HTMLInputElement).value).toBe("Sistemas");
    });

    it("lists every option of the formation, availability and modality groups unchecked by default", () => {
      renderFilters();
      expect(group("Tipo de formação").getAllByRole("checkbox").map((box) => box.closest("label")?.textContent)).toEqual([
        "Curso livre", "Técnico", "Tecnólogo", "Graduação", "Pós-graduação",
      ]);
      expect(group("Status da formação").getAllByRole("checkbox").map((box) => box.closest("label")?.textContent)).toEqual([
        "Em andamento", "Concluído", "Trancado",
      ]);
      expect(group("Disponibilidade").getAllByRole("checkbox").map((box) => box.closest("label")?.textContent)).toEqual([
        "Estágio", "CLT", "PJ", "Freelancer", "Trainee",
      ]);
      expect(group("Modalidade").getAllByRole("checkbox").map((box) => box.closest("label")?.textContent)).toEqual([
        "Presencial", "Híbrido", "Remoto",
      ]);
      expect(screen.getAllByRole("checkbox").every((box) => !(box as HTMLInputElement).checked)).toBe(true);
    });

    it("reflects the selected options as checked checkboxes", () => {
      renderFilters({
        tiposFormacao: ["TECNICO"],
        statusFormacao: ["CONCLUIDO"],
        rpvVerificado: true,
        disponibilidades: ["CLT", "PJ"],
        modalidades: ["HIBRIDO"],
      });
      expect((group("Tipo de formação").getByRole("checkbox", { name: "Técnico" }) as HTMLInputElement).checked).toBe(true);
      expect((group("Tipo de formação").getByRole("checkbox", { name: "Graduação" }) as HTMLInputElement).checked).toBe(false);
      expect((group("Status da formação").getByRole("checkbox", { name: "Concluído" }) as HTMLInputElement).checked).toBe(true);
      expect((screen.getByRole("checkbox", { name: "Somente formação RPV verificada" }) as HTMLInputElement).checked).toBe(true);
      expect((group("Disponibilidade").getByRole("checkbox", { name: "CLT" }) as HTMLInputElement).checked).toBe(true);
      expect((group("Disponibilidade").getByRole("checkbox", { name: "PJ" }) as HTMLInputElement).checked).toBe(true);
      expect((group("Modalidade").getByRole("checkbox", { name: "Híbrido" }) as HTMLInputElement).checked).toBe(true);
    });

    it("shows the selected competencies by name", () => {
      renderFilters({ competenciaIds: [2, 3] });
      expect(screen.getByRole("button", { name: "Python" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "SQL" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "React" })).toBeNull();
    });

    it("does not show the catalog warning when the catalog is available", () => {
      renderFilters();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("button", { name: "Tentar novamente" })).toBeNull();
    });
  });

  describe("what the student is looking for", () => {
    it("lists the search status, mobility and license options and the PCD notice", () => {
      renderFilters();
      expect(group("Situação de busca").getAllByRole("checkbox").map((box) => box.closest("label")?.textContent)).toEqual([
        "Buscando ativamente", "Aberto a propostas", "Não está buscando agora",
      ]);
      expect(group("Mobilidade").getAllByRole("checkbox").map((box) => box.closest("label")?.textContent)).toEqual([
        "Aceita viajar a trabalho", "Aceita mudar de cidade",
      ]);
      expect(group("Categoria de CNH (informada pelo aluno)").getAllByRole("checkbox").map((box) => box.closest("label")?.textContent)).toEqual([
        "A", "B", "C", "D", "E",
      ]);
      expect(screen.getByRole("checkbox", { name: "Interessado em vagas para PCD" })).toBeTruthy();
      expect(screen.getByText(/Use-a somente para encontrar e contatar alunos/)).toBeTruthy();
    });

    it("reflects the selected values", () => {
      renderFilters({
        statusBusca: ["ABERTO_A_PROPOSTAS"],
        aceitaViajar: true,
        categoriasCnh: ["B"],
        interesseVagaPcd: true,
        areasInteresse: ["DevOps"],
      });
      expect((group("Situação de busca").getByRole("checkbox", { name: "Aberto a propostas" }) as HTMLInputElement).checked).toBe(true);
      expect((group("Mobilidade").getByRole("checkbox", { name: "Aceita viajar a trabalho" }) as HTMLInputElement).checked).toBe(true);
      expect((group("Mobilidade").getByRole("checkbox", { name: "Aceita mudar de cidade" }) as HTMLInputElement).checked).toBe(false);
      expect((screen.getByRole("checkbox", { name: "Interessado em vagas para PCD" }) as HTMLInputElement).checked).toBe(true);
      expect(screen.getByRole("button", { name: "DevOps" })).toBeTruthy();
    });

    it("reports each toggle and area without touching the other criteria", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters();
      await user.click(group("Situação de busca").getByRole("checkbox", { name: "Buscando ativamente" }));
      expect(lastChange(setup)).toEqual(makeFilters({ statusBusca: ["BUSCANDO_ATIVAMENTE"] }));
      await user.click(group("Mobilidade").getByRole("checkbox", { name: "Aceita mudar de cidade" }));
      await user.click(group("Categoria de CNH (informada pelo aluno)").getByRole("checkbox", { name: "C" }));
      await user.click(screen.getByRole("checkbox", { name: "Interessado em vagas para PCD" }));
      expect(lastChange(setup)).toEqual(makeFilters({
        statusBusca: ["BUSCANDO_ATIVAMENTE"], aceitaMudarDeCidade: true, categoriasCnh: ["C"], interesseVagaPcd: true,
      }));

      await user.click(screen.getByLabelText("Áreas de interesse"));
      await user.click(await screen.findByRole("option", { name: "Agilidade" }));
      expect(lastChange(setup).areasInteresse).toEqual(["Agilidade"]);
    });
  });

  describe("editing the criteria", () => {
    it("reports every typed character of the name as the new value", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters();
      await user.type(screen.getByLabelText("Nome"), "Ana");
      expect(setup.onChange).toHaveBeenCalledTimes(3);
      expect(lastChange(setup)).toEqual(makeFilters({ nome: "Ana" }));
    });

    it("reports the city and the formation name without touching the other criteria", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ nome: "Ana" });
      await user.type(screen.getByLabelText("Cidade"), "Ubá");
      expect(lastChange(setup)).toEqual(makeFilters({ nome: "Ana", cidade: "Ubá" }));
      await user.type(screen.getByLabelText("Nome da formação"), "TI");
      expect(lastChange(setup)).toEqual(makeFilters({ nome: "Ana", cidade: "Ubá", formacaoNome: "TI" }));
    });

    it.each([
      ["Nome", "nome", 150],
      ["Cidade", "cidade", 120],
      ["Nome da formação", "formacaoNome", 200],
    ] as const)("cuts the %s at %i characters when a longer value is pasted in", (label, key, max) => {
      const setup = renderFilters();
      fireEvent.change(screen.getByLabelText(label), { target: { value: "a".repeat(max + 20) } });
      expect(lastChange(setup)[key]).toBe("a".repeat(max));
    });

    it("limits the text fields with the same maximum lengths in the markup", () => {
      renderFilters();
      expect(screen.getByLabelText("Nome").getAttribute("maxlength")).toBe("150");
      expect(screen.getByLabelText("Cidade").getAttribute("maxlength")).toBe("120");
      expect(screen.getByLabelText("Nome da formação").getAttribute("maxlength")).toBe("200");
    });

    it("offers every UF plus an option for all of them", async () => {
      const user = userEvent.setup({ delay: null });
      renderFilters();
      await user.click(ufSelect());
      const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
      expect(options).toHaveLength(28);
      expect(options[0]).toBe("Todas");
      expect(options).toContain("MG");
    });

    it("selects a UF from the list", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters();
      await chooseUf(user, "MG");
      expect(lastChange(setup).uf).toBe("MG");
      expect(ufSelect().textContent).toBe("MG");
    });

    it("clears the UF when all of them are chosen again", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ uf: "MG" });
      await chooseUf(user, "Todas");
      expect(lastChange(setup).uf).toBe("");
    });

    it("groups the catalog options under their category", async () => {
      const user = userEvent.setup({ delay: null });
      renderFilters();
      await user.click(screen.getByLabelText("Competências técnicas"));
      const listbox = screen.getByRole("listbox");
      expect(within(listbox).getByText("Tecnologia · Frontend")).toBeTruthy();
      expect(within(listbox).getByText("Tecnologia · Linguagens")).toBeTruthy();
    });

    it("selects competencies from the catalog and keeps the previous ones", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ competenciaIds: [1] });
      await user.click(screen.getByLabelText("Competências técnicas"));
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["React", "Python", "SQL"]);
      expect(screen.getByRole("option", { name: "React" }).getAttribute("aria-selected")).toBe("true");
      expect(screen.getByRole("option", { name: "SQL" }).getAttribute("aria-selected")).toBe("false");
      await user.click(screen.getByRole("option", { name: "SQL" }));
      expect(lastChange(setup).competenciaIds).toEqual([1, 3]);
      expect(screen.getByRole("button", { name: "SQL" })).toBeTruthy();
    });

    it("offers behavioral competencies in their own field and keeps the technical ones selected", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ competenciaIds: [1] });
      await user.click(screen.getByLabelText("Competências comportamentais"));
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["Liderança"]);
      await user.click(screen.getByRole("option", { name: "Liderança" }));
      expect(lastChange(setup).competenciaIds).toEqual([1, 4]);
    });

    it("removes a competency from the selection", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ competenciaIds: [1, 2] });
      const chip = screen.getByRole("button", { name: "React" });
      await user.click(within(chip).getByTestId("CancelIcon"));
      expect(lastChange(setup).competenciaIds).toEqual([2]);
      expect(screen.queryByRole("button", { name: "React" })).toBeNull();
    });
  });

  describe("option checkboxes", () => {
    it.each([
      ["Tipo de formação", "Pós-graduação", "tiposFormacao", "POS_GRADUACAO"],
      ["Status da formação", "Trancado", "statusFormacao", "TRANCADO"],
      ["Disponibilidade", "Freelancer", "disponibilidades", "FREELANCER"],
      ["Modalidade", "Remoto", "modalidades", "REMOTO"],
    ] as const)("adds an option to and removes it from the %s group", async (groupName, label, key, optionValue) => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters();
      const checkbox = group(groupName).getByRole("checkbox", { name: label }) as HTMLInputElement;

      await user.click(checkbox);
      expect(lastChange(setup)[key]).toEqual([optionValue]);
      expect(checkbox.checked).toBe(true);

      await user.click(checkbox);
      expect(lastChange(setup)[key]).toEqual([]);
      expect(checkbox.checked).toBe(false);
    });

    it("keeps the options already selected in the group when another one is added", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ disponibilidades: ["CLT"] });
      await user.click(group("Disponibilidade").getByRole("checkbox", { name: "Trainee" }));
      expect(lastChange(setup).disponibilidades).toEqual(["CLT", "TRAINEE"]);
      await user.click(group("Disponibilidade").getByRole("checkbox", { name: "CLT" }));
      expect(lastChange(setup).disponibilidades).toEqual(["TRAINEE"]);
    });

    it("toggles the verified-formation filter", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters();
      const checkbox = screen.getByRole("checkbox", { name: "Somente formação RPV verificada" });
      await user.click(checkbox);
      expect(lastChange(setup).rpvVerificado).toBe(true);
      await user.click(checkbox);
      expect(lastChange(setup).rpvVerificado).toBe(false);
    });
  });

  describe("applying", () => {
    const execCommand = useExecCommandSpy();

    it("applies valid criteria once, without showing an error", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ nome: "Maria", cidade: "Rio Pomba", uf: "MG", formacaoNome: "Sistemas" });
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(setup.onApply).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("applies with empty criteria, since the UF is optional", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters();
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(setup.onApply).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("applies when the user presses Enter in a text field", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters();
      await user.type(screen.getByLabelText("Nome"), "Ana{Enter}");
      expect(setup.onApply).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["name", "nome"],
      ["city", "cidade"],
      ["formation name", "formacaoNome"],
    ] as const)("blocks a %s with emoji coming from the URL and explains why", async (_name, key) => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ [key]: EMOJI });
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(screen.getByRole("alert").textContent).toBe(INVALID_SEARCH);
      expect(setup.onApply).not.toHaveBeenCalled();
    });

    it.each([
      ["Nome", "nome"],
      ["Cidade", "cidade"],
      ["Nome da formação", "formacaoNome"],
    ] as const)("drops emoji typed into %s", (label, key) => {
      const setup = renderFilters();
      fireEvent.change(screen.getByLabelText(label), { target: { value: `Ana${EMOJI}` } });
      expect(lastChange(setup)[key]).toBe("Ana");
      expect((screen.getByLabelText(label) as HTMLInputElement).value).toBe("Ana");
    });

    it.each(["Nome", "Cidade", "Nome da formação"])("removes emoji from text pasted into %s", (label) => {
      renderFilters();
      const accepted = fireEvent.paste(screen.getByLabelText(label), { clipboardData: { getData: () => `Ana${EMOJI}` } });
      expect(accepted).toBe(false);
      expect(execCommand).toHaveBeenCalledWith("insertText", false, "Ana");
    });

    it.each([
      ["Nome", "nome", 150],
      ["Cidade", "cidade", 120],
      ["Nome da formação", "formacaoNome", 200],
    ] as const)("blocks a %s longer than %i characters coming from the URL", async (_label, key, max) => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ [key]: "a".repeat(max + 1) });
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(screen.getByRole("alert").textContent).toBe(`A busca deve ter no máximo ${max} caracteres.`);
      expect(setup.onApply).not.toHaveBeenCalled();
    });

    it("accepts terms exactly at the maximum length", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ nome: "a".repeat(150), cidade: "b".repeat(120), formacaoNome: "c".repeat(200) });
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(setup.onApply).toHaveBeenCalledTimes(1);
    });

    it.each(["M", "ZZ"])("blocks the incomplete or unknown UF %s", async (uf) => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ uf });
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(screen.getByRole("alert").textContent).toBe(INVALID_UF);
      expect(setup.onApply).not.toHaveBeenCalled();
    });

    it("reports the first invalid criterion when several are invalid", async () => {
      const user = userEvent.setup({ delay: null });
      renderFilters({ nome: EMOJI, uf: "ZZ" });
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(screen.getByRole("alert").textContent).toBe(INVALID_SEARCH);
    });

    it("clears the error once the criteria are fixed and applied", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ uf: "ZZ" });
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(screen.getByRole("alert").textContent).toBe(INVALID_UF);

      await chooseUf(user, "SP");
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(setup.onApply).toHaveBeenCalledTimes(1);
    });
  });

  describe("clearing", () => {
    it("calls onClear without applying or validating", async () => {
      const user = userEvent.setup({ delay: null });
      const setup = renderFilters({ uf: "ZZ" });
      await user.click(screen.getByRole("button", { name: "Limpar" }));
      expect(setup.onClear).toHaveBeenCalledTimes(1);
      expect(setup.onApply).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("competency catalog failure", () => {
    it("explains the failure and lets the user retry", async () => {
      const user = userEvent.setup({ delay: null });
      const message = "O catálogo de competências não está disponível para esta conta.";
      const setup = renderFilters({}, message);
      expect(screen.getByRole("alert").textContent).toContain(message);
      await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
      expect(setup.retryCatalog).toHaveBeenCalledTimes(1);
    });
  });
});
