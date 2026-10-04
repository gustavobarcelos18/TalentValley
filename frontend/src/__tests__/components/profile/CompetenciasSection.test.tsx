import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompetenciasSection } from "@/components/profile/CompetenciasSection";
import { ApiError } from "@/lib/api";
import { fetchCompetenciaCatalog, updateCompetencias } from "@/lib/student";
import type { CatalogoCompetenciaResponse } from "@/types/student";
import { makeSectionProps } from "./profileFixtures";

vi.mock("@/lib/student");

const SECTION_TITLE = "Competências";
const EDIT_LABEL = "Editar competências";
const ADD_LABEL = "Adicionar competências";
const EMPTY_MESSAGE = "Selecione as competências que representam suas habilidades.";
const DIALOG_NAME = "Editar competências";
const COMBOBOX_NAME = "Competências";
const SAVE_ERROR_FALLBACK = "Não foi possível salvar as competências. Tente novamente.";
const CATALOG_ERROR = "Não foi possível carregar o catálogo de competências.";
const NOTIFY_UPDATED = "Competências atualizadas.";
const REACT = { id: 1, nome: "React" };
const TYPESCRIPT = { id: 2, nome: "TypeScript" };
const DOTNET = { id: 3, nome: "ASP.NET Core" };
const CATALOG: CatalogoCompetenciaResponse[] = [REACT, TYPESCRIPT, DOTNET];

const catalogMock = vi.mocked(fetchCompetenciaCatalog);
const updateMock = vi.mocked(updateCompetencias);

beforeEach(() => {
  vi.resetAllMocks();
  catalogMock.mockResolvedValue(CATALOG);
});

function renderSection(competencias = [REACT]) {
  const props = makeSectionProps({ competencias });
  render(<CompetenciasSection {...props} />);
  return props;
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: EDIT_LABEL }));
  const dialog = await screen.findByRole("dialog", { name: DIALOG_NAME });
  const combobox = within(dialog).getByRole("combobox", { name: COMBOBOX_NAME }) as HTMLInputElement;
  await waitFor(() => expect(combobox.disabled).toBe(false));
  return { dialog, combobox };
}

async function pickOption(user: ReturnType<typeof userEvent.setup>, combobox: HTMLElement, name: string) {
  await user.click(combobox);
  await user.click(await screen.findByRole("option", { name }));
}

describe("CompetenciasSection", () => {
  it("lists the student's competencies as chips without the empty prompt", () => {
    renderSection([REACT, TYPESCRIPT]);

    expect(screen.getByRole("heading", { name: SECTION_TITLE })).toBeTruthy();
    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.getByText("TypeScript")).toBeTruthy();
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
    expect(screen.queryByRole("button", { name: ADD_LABEL })).toBeNull();
  });

  it("shows the empty prompt with an add action when there are no competencies", () => {
    renderSection([]);

    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("button", { name: ADD_LABEL })).toBeTruthy();
    expect(screen.queryByText("React")).toBeNull();
  });

  it("does not load the catalog until the dialog is opened", () => {
    renderSection();

    expect(catalogMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the dialog from the empty-state action", async () => {
    const user = userEvent.setup();
    renderSection([]);

    await user.click(screen.getByRole("button", { name: ADD_LABEL }));

    expect(await screen.findByRole("dialog", { name: DIALOG_NAME })).toBeTruthy();
    expect(catalogMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the selector disabled and busy until the catalog arrives", async () => {
    const user = userEvent.setup();
    let resolveCatalog!: (items: CatalogoCompetenciaResponse[]) => void;
    catalogMock.mockReturnValue(new Promise((resolve) => { resolveCatalog = resolve; }));
    renderSection();

    await user.click(screen.getByRole("button", { name: EDIT_LABEL }));
    const dialog = await screen.findByRole("dialog", { name: DIALOG_NAME });
    const combobox = within(dialog).getByRole("combobox", { name: COMBOBOX_NAME }) as HTMLInputElement;
    expect(combobox.disabled).toBe(true);

    resolveCatalog(CATALOG);
    await waitFor(() => expect(combobox.disabled).toBe(false));
  });

  it("starts the edit with the current competencies already selected", async () => {
    const user = userEvent.setup();
    renderSection([REACT, TYPESCRIPT]);

    const { dialog } = await openDialog(user);

    expect(within(dialog).getByText("React")).toBeTruthy();
    expect(within(dialog).getByText("TypeScript")).toBeTruthy();
    expect(within(dialog).queryByText("ASP.NET Core")).toBeNull();
  });

  it("saves only the selected catalog ids, then closes and reports the change", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue(undefined);
    const props = renderSection();

    const { dialog, combobox } = await openDialog(user);
    await pickOption(user, combobox, "TypeScript");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith(NOTIFY_UPDATED));
    expect(updateMock).toHaveBeenCalledWith({ competenciaIds: [1, 2] });
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("removes the last selected competency with the keyboard before saving", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue(undefined);
    const props = renderSection([REACT, TYPESCRIPT]);

    const { dialog, combobox } = await openDialog(user);
    await user.click(combobox);
    await user.keyboard("{Backspace}");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ competenciaIds: [1] }));
    await waitFor(() => expect(props.notify).toHaveBeenCalledWith(NOTIFY_UPDATED));
  });

  it("allows clearing every competency", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue(undefined);
    renderSection();

    const { dialog, combobox } = await openDialog(user);
    await user.click(combobox);
    await user.keyboard("{Backspace}");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ competenciaIds: [] }));
  });

  it("discards the edit when the dialog is cancelled", async () => {
    const user = userEvent.setup();
    const props = renderSection();

    const { dialog, combobox } = await openDialog(user);
    await pickOption(user, combobox, "TypeScript");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(updateMock).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("shows the API error and keeps the dialog open when saving fails", async () => {
    const user = userEvent.setup();
    updateMock.mockRejectedValue(new ApiError(400, "Inválido", { title: "Competência inexistente no catálogo" }));
    const props = renderSection();

    const { dialog } = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Competência inexistente no catálogo");
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: DIALOG_NAME })).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: "Salvar" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("falls back to the generic message when the save rejection has no message", async () => {
    const user = userEvent.setup();
    updateMock.mockRejectedValue("falha");
    renderSection();

    const { dialog } = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(SAVE_ERROR_FALLBACK);
  });

  it("locks the form while the save is pending", async () => {
    const user = userEvent.setup();
    let resolveSave!: () => void;
    updateMock.mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve; }));
    const props = renderSection();

    const { dialog, combobox } = await openDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));

    expect(await within(dialog).findByRole("button", { name: "Salvando..." })).toBeTruthy();
    expect(combobox.disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);

    resolveSave();
    await waitFor(() => expect(props.notify).toHaveBeenCalledWith(NOTIFY_UPDATED));
  });

  it("warns when the catalog cannot be loaded but still lets the dialog be dismissed", async () => {
    const user = userEvent.setup();
    catalogMock.mockRejectedValue(new Error("offline"));
    renderSection();

    await user.click(screen.getByRole("button", { name: EDIT_LABEL }));
    const dialog = await screen.findByRole("dialog", { name: DIALOG_NAME });

    const warning = await within(dialog).findByRole("alert");
    expect(warning.textContent).toBe(CATALOG_ERROR);
    const combobox = within(dialog).getByRole("combobox", { name: COMBOBOX_NAME }) as HTMLInputElement;
    expect(combobox.disabled).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
