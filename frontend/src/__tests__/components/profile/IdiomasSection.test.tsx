import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IdiomasSection } from "@/components/profile/IdiomasSection";
import { fetchIdiomaCatalog, updateIdiomas } from "@/lib/student";
import type { AlunoIdiomaResponse, CatalogoIdiomaResponse } from "@/types/student";
import { makeSectionProps } from "./profileFixtures";

vi.mock("@/lib/student", () => ({ fetchIdiomaCatalog: vi.fn(), updateIdiomas: vi.fn() }));

vi.setConfig({ testTimeout: 15_000 });

const mockCatalog = vi.mocked(fetchIdiomaCatalog);
const mockUpdate = vi.mocked(updateIdiomas);

const EDIT_LABEL = "Editar idiomas";
const LANGUAGES_LABEL = "Idiomas";
const SAVE_LABEL = "Salvar";
const EMPTY_MESSAGE = "Informe os idiomas que você fala e o nível de cada um.";
const CATALOG_ERROR = "Não foi possível carregar o catálogo de idiomas.";
const GENERIC_SAVE_ERROR = "Não foi possível salvar os idiomas. Tente novamente.";
const ENGLISH = "Inglês";
const SPANISH = "Espanhol";
const FRENCH = "Francês";

const CATALOG: CatalogoIdiomaResponse[] = [
  { id: 1, nome: ENGLISH },
  { id: 2, nome: SPANISH },
  { id: 3, nome: FRENCH },
];
const ENGLISH_INTERMEDIATE: AlunoIdiomaResponse = { idiomaId: 1, nome: ENGLISH, nivel: "INTERMEDIARIO" };
const SPANISH_NATIVE: AlunoIdiomaResponse = { idiomaId: 2, nome: SPANISH, nivel: "NATIVO" };

type User = ReturnType<typeof userEvent.setup>;

function renderSection(idiomas: AlunoIdiomaResponse[]) {
  const props = makeSectionProps({ idiomas });
  render(<IdiomasSection {...props} />);
  return props;
}

function languageInput(): HTMLInputElement {
  return screen.getByRole("combobox", { name: LANGUAGES_LABEL }) as HTMLInputElement;
}

async function openForm(user: User) {
  await user.click(screen.getByRole("button", { name: EDIT_LABEL }));
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(languageInput().disabled).toBe(false));
  return dialog;
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: SAVE_LABEL }));
}

async function addLanguage(user: User, name: string) {
  await user.click(languageInput());
  await user.click(await screen.findByRole("option", { name }));
  await user.keyboard("{Escape}");
}

/** The level select sits in the same row as the language name shown in the "Níveis" list. */
function levelSelect(language: string): HTMLElement {
  const row = screen.getByText(language, { selector: "p" }).parentElement as HTMLElement;
  return within(row).getByRole("combobox");
}

async function chooseLevel(user: User, language: string, level: string) {
  await user.click(levelSelect(language));
  await user.click(await screen.findByRole("option", { name: level }));
}

describe("IdiomasSection display", () => {
  it("shows a chip with the name and level of each language", () => {
    renderSection([ENGLISH_INTERMEDIATE, SPANISH_NATIVE]);

    expect(screen.getByText("Inglês - Intermediário")).toBeTruthy();
    expect(screen.getByText("Espanhol - Nativo")).toBeTruthy();
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it("shows the empty state when there are no languages", () => {
    renderSection([]);

    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adicionar idiomas" })).toBeTruthy();
  });

  it("opens the form from the empty state action", async () => {
    mockCatalog.mockResolvedValue(CATALOG);
    const user = userEvent.setup();
    renderSection([]);

    await user.click(screen.getByRole("button", { name: "Adicionar idiomas" }));

    expect(await screen.findByRole("dialog", { name: EDIT_LABEL })).toBeTruthy();
  });
});

describe("IdiomasSection form", () => {
  beforeEach(() => {
    mockCatalog.mockReset();
    mockUpdate.mockReset();
    mockCatalog.mockResolvedValue(CATALOG);
    mockUpdate.mockResolvedValue(undefined);
  });

  it("fetches the catalog and keeps the field disabled until it arrives", async () => {
    let resolveCatalog: (items: CatalogoIdiomaResponse[]) => void = () => undefined;
    mockCatalog.mockReturnValue(new Promise<CatalogoIdiomaResponse[]>((resolve) => { resolveCatalog = resolve; }));
    const user = userEvent.setup();
    renderSection([]);

    await user.click(screen.getByRole("button", { name: EDIT_LABEL }));
    await screen.findByRole("dialog");

    expect(languageInput().disabled).toBe(true);
    resolveCatalog(CATALOG);
    await waitFor(() => expect(languageInput().disabled).toBe(false));
    expect(mockCatalog).toHaveBeenCalledTimes(1);
  });

  it("lists the catalog languages as options", async () => {
    const user = userEvent.setup();
    renderSection([]);
    await openForm(user);

    await user.click(languageInput());

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([ENGLISH, SPANISH, FRENCH]);
  });

  it("shows the current languages as tags with a level selector each", async () => {
    const user = userEvent.setup();
    renderSection([ENGLISH_INTERMEDIATE, SPANISH_NATIVE]);

    const dialog = await openForm(user);

    expect(within(dialog).getByText("Níveis")).toBeTruthy();
    expect(levelSelect("Inglês").textContent).toBe("Intermediário");
    expect(levelSelect("Espanhol").textContent).toBe("Nativo");
  });

  it("does not show the level list while no language is selected", async () => {
    const user = userEvent.setup();
    renderSection([]);

    const dialog = await openForm(user);

    expect(within(dialog).queryByText("Níveis")).toBeNull();
  });

  it("warns that the catalog could not be loaded and leaves the field usable", async () => {
    mockCatalog.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    renderSection([ENGLISH_INTERMEDIATE]);

    await user.click(screen.getByRole("button", { name: EDIT_LABEL }));

    expect((await screen.findByRole("alert")).textContent).toBe(CATALOG_ERROR);
    expect(languageInput().disabled).toBe(false);
  });

  it("still saves the current languages when the catalog failed to load", async () => {
    mockCatalog.mockRejectedValue(new Error("offline"));
    const user = userEvent.setup();
    const props = renderSection([ENGLISH_INTERMEDIATE]);
    await user.click(screen.getByRole("button", { name: EDIT_LABEL }));
    await screen.findByRole("alert");

    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({ idiomas: [{ idiomaId: 1, nivel: "INTERMEDIARIO" }] });
  });

  it("does not update state when the catalog resolves after the dialog closed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      let resolveCatalog: (items: CatalogoIdiomaResponse[]) => void = () => undefined;
      mockCatalog.mockReturnValue(new Promise<CatalogoIdiomaResponse[]>((resolve) => { resolveCatalog = resolve; }));
      const user = userEvent.setup();
      const props = renderSection([]);
      await user.click(screen.getByRole("button", { name: EDIT_LABEL }));
      await screen.findByRole("dialog");
      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      resolveCatalog(CATALOG);
      await act(async () => {});

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(props.onChanged).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    }
  });

  it("does not update state when the catalog rejects after the dialog closed", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      let rejectCatalog: (reason: Error) => void = () => undefined;
      mockCatalog.mockReturnValue(new Promise<CatalogoIdiomaResponse[]>((_, reject) => { rejectCatalog = reject; }));
      const user = userEvent.setup();
      const props = renderSection([]);
      await user.click(screen.getByRole("button", { name: EDIT_LABEL }));
      await screen.findByRole("dialog");
      await user.click(screen.getByRole("button", { name: "Cancelar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

      rejectCatalog(new Error("offline"));
      await act(async () => {});

      expect(screen.queryByText(CATALOG_ERROR)).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(props.onChanged).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(consoleWarn).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
      consoleWarn.mockRestore();
    }
  });

  it("closes without saving when the user cancels", async () => {
    const user = userEvent.setup();
    const props = renderSection([ENGLISH_INTERMEDIATE]);
    await openForm(user);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it("saves the unchanged languages, closes and notifies", async () => {
    const user = userEvent.setup();
    const props = renderSection([ENGLISH_INTERMEDIATE, SPANISH_NATIVE]);
    await openForm(user);

    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({
      idiomas: [
        { idiomaId: 1, nivel: "INTERMEDIARIO" },
        { idiomaId: 2, nivel: "NATIVO" },
      ],
    });
    expect(props.notify).toHaveBeenCalledWith("Idiomas atualizados.");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("adds a new language at the basic level", async () => {
    const user = userEvent.setup();
    const props = renderSection([]);
    await openForm(user);

    await addLanguage(user, FRENCH);

    expect(levelSelect("Francês").textContent).toBe("Básico");
    submit();
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({ idiomas: [{ idiomaId: 3, nivel: "BASICO" }] });
  });

  it("changes the level of one language without touching the others", async () => {
    const user = userEvent.setup();
    const props = renderSection([ENGLISH_INTERMEDIATE, SPANISH_NATIVE]);
    await openForm(user);

    await chooseLevel(user, ENGLISH, "Fluente");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({
      idiomas: [
        { idiomaId: 1, nivel: "FLUENTE" },
        { idiomaId: 2, nivel: "NATIVO" },
      ],
    });
  });

  it("keeps the chosen level of existing languages when another language is added", async () => {
    const user = userEvent.setup();
    const props = renderSection([ENGLISH_INTERMEDIATE]);
    await openForm(user);
    await chooseLevel(user, ENGLISH, "Avançado");

    await addLanguage(user, SPANISH);
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({
      idiomas: [
        { idiomaId: 1, nivel: "AVANCADO" },
        { idiomaId: 2, nivel: "BASICO" },
      ],
    });
  });

  it("removes a language with the keyboard and saves the remaining ones", async () => {
    const user = userEvent.setup();
    const props = renderSection([ENGLISH_INTERMEDIATE, SPANISH_NATIVE]);
    await openForm(user);

    await user.click(languageInput());
    await user.keyboard("{Backspace}");

    expect(screen.queryByText(SPANISH, { selector: "p" })).toBeNull();
    submit();
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({ idiomas: [{ idiomaId: 1, nivel: "INTERMEDIARIO" }] });
  });

  it("saves an empty list when every language is removed", async () => {
    const user = userEvent.setup();
    const props = renderSection([ENGLISH_INTERMEDIATE]);
    await openForm(user);

    await user.click(languageInput());
    await user.keyboard("{Backspace}");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({ idiomas: [] });
  });

  it("shows the API error message and keeps the dialog open when saving fails", async () => {
    const user = userEvent.setup();
    const props = renderSection([ENGLISH_INTERMEDIATE]);
    mockUpdate.mockRejectedValue(new Error("Idioma inválido."));
    await openForm(user);

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe("Idioma inválido.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the failure carries no message", async () => {
    const user = userEvent.setup();
    renderSection([ENGLISH_INTERMEDIATE]);
    mockUpdate.mockRejectedValue("boom");
    await openForm(user);

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_SAVE_ERROR);
  });

  it("disables the form while saving and ignores duplicate submits", async () => {
    const user = userEvent.setup();
    const props = renderSection([ENGLISH_INTERMEDIATE]);
    let resolveSave: () => void = () => undefined;
    mockUpdate.mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve; }));
    await openForm(user);

    submit();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Salvando..." }).hasAttribute("disabled")).toBe(true);
    expect(languageInput().disabled).toBe(true);
    expect(levelSelect("Inglês").getAttribute("aria-disabled")).toBe("true");
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    resolveSave();
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
  });
});
