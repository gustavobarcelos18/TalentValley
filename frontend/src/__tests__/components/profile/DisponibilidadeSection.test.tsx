import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DisponibilidadeSection } from "@/components/profile/DisponibilidadeSection";
import { updateDisponibilidade } from "@/lib/student";
import type { ModalidadeTrabalho, TipoDisponibilidade } from "@/types/student";
import { makeSectionProps } from "./profileFixtures";

vi.mock("@/lib/student", () => ({ updateDisponibilidade: vi.fn() }));

vi.setConfig({ testTimeout: 15_000 });

const mockUpdate = vi.mocked(updateDisponibilidade);

const EDIT_LABEL = "Editar disponibilidade e modalidade";
const DISP_LABEL = "Disponibilidade";
const MOD_LABEL = "Modalidade de trabalho";
const SAVE_LABEL = "Salvar";
const EMPTY_MESSAGE = "Informe os tipos de vaga que você busca e como prefere trabalhar.";
const GENERIC_SAVE_ERROR = "Não foi possível salvar a disponibilidade. Tente novamente.";

type User = ReturnType<typeof userEvent.setup>;

function renderSection(disponibilidades: TipoDisponibilidade[], modalidades: ModalidadeTrabalho[]) {
  const props = makeSectionProps({ disponibilidades, modalidades });
  render(<DisponibilidadeSection {...props} />);
  return props;
}

async function openForm(user: User) {
  await user.click(screen.getByRole("button", { name: EDIT_LABEL }));
  return screen.findByRole("dialog");
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: SAVE_LABEL }));
}

async function toggleOption(user: User, dialog: HTMLElement, combobox: string, option: string) {
  await user.click(within(dialog).getByRole("combobox", { name: combobox }));
  await user.click(await screen.findByRole("option", { name: option }));
  await user.keyboard("{Escape}");
}

describe("DisponibilidadeSection display", () => {
  it("shows a chip for each availability and work mode", () => {
    renderSection(["ESTAGIO", "CLT"], ["REMOTO", "HIBRIDO"]);

    for (const label of ["Estágio", "CLT", "Remoto", "Híbrido"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText("PJ")).toBeNull();
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it("shows the empty state when nothing is selected", () => {
    renderSection([], []);

    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Informar disponibilidade" })).toBeTruthy();
  });

  it.each([
    ["only availability", ["PJ"] as TipoDisponibilidade[], [] as ModalidadeTrabalho[], "PJ"],
    ["only work mode", [] as TipoDisponibilidade[], ["PRESENCIAL"] as ModalidadeTrabalho[], "Presencial"],
  ])("does not show the empty state with %s", (_case, disp, mod, label) => {
    renderSection(disp, mod);

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it("opens the form from the empty state action", async () => {
    const user = userEvent.setup();
    renderSection([], []);

    await user.click(screen.getByRole("button", { name: "Informar disponibilidade" }));

    expect(await screen.findByRole("dialog", { name: EDIT_LABEL })).toBeTruthy();
  });
});

describe("DisponibilidadeSection form", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(undefined);
  });

  it("opens the dialog with the current selections as tags", async () => {
    const user = userEvent.setup();
    renderSection(["ESTAGIO", "TRAINEE"], ["REMOTO"]);

    const dialog = await openForm(user);

    expect(within(dialog).getByText("Estágio")).toBeTruthy();
    expect(within(dialog).getByText("Trainee")).toBeTruthy();
    expect(within(dialog).getByText("Remoto")).toBeTruthy();
    expect(within(dialog).queryByText("Presencial")).toBeNull();
  });

  it("lists every option and marks the selected ones", async () => {
    const user = userEvent.setup();
    renderSection(["ESTAGIO"], []);
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("combobox", { name: DISP_LABEL }));

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Estágio", "CLT", "PJ", "Freelancer", "Trainee"]);
    expect((within(options[0]).getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    expect((within(options[1]).getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("lists the work mode options and marks the selected ones", async () => {
    const user = userEvent.setup();
    renderSection([], ["HIBRIDO"]);
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("combobox", { name: MOD_LABEL }));

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Presencial", "Híbrido", "Remoto"]);
    expect((within(options[1]).getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    expect((within(options[0]).getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("closes without saving when the user cancels", async () => {
    const user = userEvent.setup();
    const props = renderSection(["ESTAGIO"], ["REMOTO"]);
    await openForm(user);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it("saves the unchanged selections, closes and notifies", async () => {
    const user = userEvent.setup();
    const props = renderSection(["ESTAGIO"], ["REMOTO"]);
    await openForm(user);

    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({ disponibilidades: ["ESTAGIO"], modalidades: ["REMOTO"] });
    expect(props.notify).toHaveBeenCalledWith("Disponibilidade atualizada.");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("saves newly added availability and work mode using the backend enum values", async () => {
    const user = userEvent.setup();
    const props = renderSection([], []);
    const dialog = await openForm(user);

    await toggleOption(user, dialog, DISP_LABEL, "CLT");
    await toggleOption(user, dialog, DISP_LABEL, "Freelancer");
    await toggleOption(user, dialog, MOD_LABEL, "Híbrido");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({ disponibilidades: ["CLT", "FREELANCER"], modalidades: ["HIBRIDO"] });
  });

  it("removes a selection that is picked again in the list", async () => {
    const user = userEvent.setup();
    const props = renderSection(["ESTAGIO", "PJ"], ["REMOTO", "PRESENCIAL"]);
    const dialog = await openForm(user);

    await toggleOption(user, dialog, DISP_LABEL, "Estágio");
    await toggleOption(user, dialog, MOD_LABEL, "Remoto");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({ disponibilidades: ["PJ"], modalidades: ["PRESENCIAL"] });
  });

  it("removes the last tag with the keyboard and allows saving an empty selection", async () => {
    const user = userEvent.setup();
    const props = renderSection(["ESTAGIO"], ["REMOTO"]);
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("combobox", { name: DISP_LABEL }));
    await user.keyboard("{Backspace}");
    await user.click(within(dialog).getByRole("combobox", { name: MOD_LABEL }));
    await user.keyboard("{Backspace}");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({ disponibilidades: [], modalidades: [] });
  });

  it("shows the API error message and keeps the dialog open when saving fails", async () => {
    const user = userEvent.setup();
    const props = renderSection(["ESTAGIO"], ["REMOTO"]);
    mockUpdate.mockRejectedValue(new Error("Perfil bloqueado."));
    await openForm(user);

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe("Perfil bloqueado.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the failure carries no message", async () => {
    const user = userEvent.setup();
    renderSection(["ESTAGIO"], ["REMOTO"]);
    mockUpdate.mockRejectedValue("boom");
    await openForm(user);

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_SAVE_ERROR);
  });

  it("shows progress while saving and ignores duplicate submits", async () => {
    const user = userEvent.setup();
    const props = renderSection(["ESTAGIO"], ["REMOTO"]);
    let resolveSave: () => void = () => undefined;
    mockUpdate.mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve; }));
    await openForm(user);

    submit();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Salvando..." }).hasAttribute("disabled")).toBe(true);
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    resolveSave();
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
  });
});
