import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderThemed as render } from "../recruiter/renderThemed";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DadosBasicosSection } from "@/components/profile/DadosBasicosSection";
import { municipioCache } from "@/components/registration/location";
import { updateDadosBasicos } from "@/lib/student";
import type { DadosBasicosResponse } from "@/types/student";
import { EMOJI, useExecCommandSpy } from "../registration/stepTestHelpers";
import { makeProfile, makeSectionProps } from "./profileFixtures";

vi.mock("@/lib/student", () => ({ updateDadosBasicos: vi.fn() }));

vi.setConfig({ testTimeout: 15_000 });

const mockUpdate = vi.mocked(updateDadosBasicos);

const EDIT_LABEL = "Editar dados básicos";
const NAME_LABEL = "Nome completo";
const CITY_LABEL = "Cidade";
const UF_LABEL = "UF";
const SAVE_LABEL = "Salvar";
const NAME_ERROR = "Informe um nome válido, sem números.";
const CITY_ERROR = "Informe uma cidade válida, sem números.";
const UF_ERROR = "Selecione uma UF válida.";
const NAME_HINT = "Use letras, espaços, hífen e apóstrofo.";
const GENERIC_SAVE_ERROR = "Não foi possível salvar os dados básicos. Tente novamente.";
const NO_LOCATION = "Localização não informada";

const MANUAL_CITY_MESSAGE = "Não foi possível carregar a lista oficial. Digite a cidade manualmente ou tente novamente.";

const BASE_DADOS = makeProfile().dadosBasicos;

const MUNICIPIOS = {
  MG: [
    { id: 3153004, nome: "Rio Pomba" },
    { id: 3170404, nome: "Ubá" },
  ],
  SP: [{ id: 3509502, nome: "Campinas" }],
  RJ: [{ id: 3304557, nome: "Rio de Janeiro" }],
};

function seedMunicipios() {
  municipioCache.clear();
  for (const [uf, list] of Object.entries(MUNICIPIOS)) municipioCache.set(uf, list);
}

function renderSection(dados: Partial<DadosBasicosResponse> = {}) {
  const props = makeSectionProps({ dadosBasicos: { ...BASE_DADOS, ...dados } });
  render(<DadosBasicosSection {...props} />);
  return props;
}

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: EDIT_LABEL }));
  return screen.findByRole("dialog");
}

function input(label: string): HTMLInputElement {
  return screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;
}

function cityInput(): HTMLInputElement {
  return screen.getByRole("combobox", { name: new RegExp(`^${CITY_LABEL}`) }) as HTMLInputElement;
}

async function chooseCity(user: ReturnType<typeof userEvent.setup>, city: string) {
  await user.click(cityInput());
  await user.click(await screen.findByRole("option", { name: city }));
}

function setValue(label: string, value: string) {
  fireEvent.change(input(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: SAVE_LABEL }));
}

async function chooseUf(user: ReturnType<typeof userEvent.setup>, uf: string) {
  await user.click(screen.getByRole("combobox", { name: UF_LABEL }));
  await user.click(await screen.findByRole("option", { name: uf }));
}

describe("DadosBasicosSection display", () => {
  it("shows the name and the city with its UF", () => {
    renderSection();

    expect(screen.getByText("Maria Souza")).toBeTruthy();
    expect(screen.getByText("Rio Pomba - MG")).toBeTruthy();
  });

  it.each([
    ["only the city", { cidade: "Rio Pomba", uf: null }, "Rio Pomba"],
    ["only the UF", { cidade: null, uf: "MG" }, "MG"],
  ])("shows %s when the other location part is missing", (_case, dados, expected) => {
    renderSection(dados);

    expect(screen.getByText(expected)).toBeTruthy();
    expect(screen.queryByText(NO_LOCATION)).toBeNull();
  });

  it("tells the user the location is missing when neither city nor UF is set", () => {
    renderSection({ cidade: null, uf: null });

    expect(screen.getByText(NO_LOCATION)).toBeTruthy();
  });
});

describe("DadosBasicosSection form", () => {
  const execCommand = useExecCommandSpy();

  beforeEach(() => {
    seedMunicipios();
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(undefined);
  });

  it("opens the dialog prefilled with the current values", async () => {
    const user = userEvent.setup();
    renderSection();

    const dialog = await openForm(user);

    expect(within(dialog).getByText("Editar dados básicos")).toBeTruthy();
    expect(input(NAME_LABEL).value).toBe("Maria Souza");
    expect(cityInput().value).toBe("Rio Pomba");
    expect(screen.getByRole("combobox", { name: UF_LABEL }).textContent).toBe("MG");
    expect(screen.getByText(NAME_HINT)).toBeTruthy();
  });

  it("opens with an empty city and UF when the profile has none", async () => {
    const user = userEvent.setup();
    renderSection({ cidade: null, uf: null });

    await openForm(user);

    expect(cityInput().value).toBe("");
    expect(cityInput().disabled).toBe(true);
    expect(screen.getByRole("combobox", { name: UF_LABEL }).textContent).not.toMatch(/[A-Z]/);
  });

  it("opens with an empty city when the profile has a city but no UF", async () => {
    const user = userEvent.setup();
    renderSection({ cidade: "Rio Pomba", uf: null });

    await openForm(user);

    expect(cityInput().value).toBe("");
  });

  it("only offers the cities of the chosen UF from the official list", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    await user.click(cityInput());

    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual(["Rio Pomba", "Ubá"]);
  });

  it("lists the Brazilian UFs as options", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    await user.click(screen.getByRole("combobox", { name: UF_LABEL }));

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(27);
    expect(options.map((option) => option.textContent)).toContain("RJ");
  });

  it("closes without saving when the user cancels", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    await openForm(user);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it("saves the edited values with normalized whitespace, closes and notifies", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    await openForm(user);

    setValue(NAME_LABEL, "  Ana   Paula   Lima ");
    await chooseUf(user, "SP");
    await chooseCity(user, "Campinas");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({
      nomeCompleto: "Ana Paula Lima",
      cidade: "Campinas",
      uf: "SP",
    });
    expect(props.notify).toHaveBeenCalledWith("Dados básicos atualizados.");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("saves the unchanged values as they are", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    await openForm(user);

    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({ nomeCompleto: "Maria Souza", cidade: "Rio Pomba", uf: "MG" });
  });

  it("strips digits from the name while typing", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    setValue(NAME_LABEL, "Jo4o S1lva");

    expect(input(NAME_LABEL).value).toBe("Joo Slva");
  });

  it("limits the name length", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    setValue(NAME_LABEL, "a".repeat(200));

    expect(input(NAME_LABEL).value).toHaveLength(150);
  });

  it.each([[NAME_LABEL, "Maria"], [CITY_LABEL, "Rio"]])(
    "removes emoji from text pasted into %s",
    async (label, text) => {
      const user = userEvent.setup();
      renderSection();
      await openForm(user);

      const field = label === CITY_LABEL ? cityInput() : input(label);
      const accepted = fireEvent.paste(field, { clipboardData: { getData: () => `${text}${EMOJI}` } });

      expect(accepted).toBe(false);
      expect(execCommand).toHaveBeenCalledWith("insertText", false, text);
    },
  );

  it("lets a paste without emoji go through untouched", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    const accepted = fireEvent.paste(input(NAME_LABEL), { clipboardData: { getData: () => "Maria" } });

    expect(accepted).toBe(true);
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("rejects a too-short name, flags the field and does not call the API", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    await openForm(user);

    setValue(NAME_LABEL, "Jo");

    expect(input(NAME_LABEL).getAttribute("aria-invalid")).toBe("true");
    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(NAME_ERROR);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it("rejects a name that does not start with a letter", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    setValue(NAME_LABEL, "--Maria");
    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(NAME_ERROR);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("asks for the city again after the UF changes", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    await chooseUf(user, "SP");

    expect(cityInput().value).toBe("");
    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(CITY_ERROR);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("keeps the city when the same UF is chosen again", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    await chooseUf(user, "MG");

    expect(cityInput().value).toBe("Rio Pomba");
  });

  it("clears a saved city that is not on the official list", async () => {
    const user = userEvent.setup();
    renderSection({ cidade: "Cidade Inventada", uf: "MG" });
    await openForm(user);

    await waitFor(() => expect(cityInput().value).toBe(""));
    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(CITY_ERROR);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("uses the official spelling when the saved city differs only in accents or case", async () => {
    const user = userEvent.setup();
    const props = renderSection({ cidade: "uba", uf: "MG" });
    await openForm(user);

    await waitFor(() => expect(cityInput().value).toBe("Ubá"));
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({ nomeCompleto: "Maria Souza", cidade: "Ubá", uf: "MG" });
  });

  it("requires a UF when the profile has none", async () => {
    const user = userEvent.setup();
    const props = renderSection({ uf: null });
    await openForm(user);

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(UF_ERROR);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it("accepts the form once a UF is chosen after a validation error", async () => {
    const user = userEvent.setup();
    const props = renderSection({ uf: null });
    await openForm(user);
    submit();
    await screen.findByRole("alert");

    await chooseUf(user, "RJ");
    await chooseCity(user, "Rio de Janeiro");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({ nomeCompleto: "Maria Souza", cidade: "Rio de Janeiro", uf: "RJ" });
  });

  it("shows the API error message and keeps the dialog open when saving fails", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    mockUpdate.mockRejectedValue(new Error("Serviço indisponível."));
    await openForm(user);

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe("Serviço indisponível.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the failure carries no message", async () => {
    const user = userEvent.setup();
    renderSection();
    mockUpdate.mockRejectedValue("boom");
    await openForm(user);

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_SAVE_ERROR);
  });

  it("disables the form and shows progress while saving, then ignores duplicate submits", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    let resolveSave: () => void = () => undefined;
    mockUpdate.mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve; }));
    await openForm(user);

    submit();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Salvando..." }).hasAttribute("disabled")).toBe(true);
    expect(input(NAME_LABEL).disabled).toBe(true);
    expect(cityInput().disabled).toBe(true);
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    resolveSave();
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
  });
});

describe("DadosBasicosSection form when the official city list is unavailable", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    municipioCache.clear();
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(undefined);
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lets the user type the city and offers to try again", async () => {
    const user = userEvent.setup();
    const props = renderSection({ cidade: "Rio Pomba", uf: "MG" });
    await openForm(user);

    expect(await screen.findByText(MANUAL_CITY_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
    setValue(CITY_LABEL, "  Rio   Pomba ");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({ nomeCompleto: "Maria Souza", cidade: "Rio Pomba", uf: "MG" });
  });

  it("strips digits and limits the typed city", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);
    await screen.findByText(MANUAL_CITY_MESSAGE);

    setValue(CITY_LABEL, "Ub4 Cidade2");
    expect(input(CITY_LABEL).value).toBe("Ub Cidade");
    setValue(CITY_LABEL, "b".repeat(200));
    expect(input(CITY_LABEL).value).toHaveLength(120);
  });

  it("rejects a typed city that is too short", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);
    await screen.findByText(MANUAL_CITY_MESSAGE);

    setValue(CITY_LABEL, "R");
    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(CITY_ERROR);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("checks the typed city against the official list once it loads again", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);
    await screen.findByText(MANUAL_CITY_MESSAGE);
    setValue(CITY_LABEL, "Cidade Inventada");
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(MUNICIPIOS.MG) } as Response);

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    await waitFor(() => expect(screen.queryByText(MANUAL_CITY_MESSAGE)).toBeNull());
    await waitFor(() => expect(cityInput().value).toBe(""));
  });
});
