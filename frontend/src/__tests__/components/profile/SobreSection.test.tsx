import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SobreSection } from "@/components/profile/SobreSection";
import { updateSobre } from "@/lib/student";
import { makeSectionProps } from "./profileFixtures";

vi.mock("@/lib/student", () => ({
  updateSobre: vi.fn(),
}));

const BIO = "Estudante de sistemas de informação.";
const EMPTY_MESSAGE = "Conte um pouco sobre você, sua experiência e objetivos profissionais.";
const EDIT_LABEL = "Editar sobre";
const FIELD_LABEL = "Sobre você";
const DIALOG_TITLE = "Editar sobre";
const SUCCESS_MESSAGE = "Sobre atualizado.";
const FALLBACK_ERROR = "Não foi possível salvar o sobre. Tente novamente.";
const BIO_MAX = 1500;

const updateSobreMock = vi.mocked(updateSobre);

function renderSection(bio: string | null) {
  const props = makeSectionProps({ sobre: { bio } });
  render(<SobreSection {...props} />);
  return props;
}

async function openEditor() {
  await userEvent.click(screen.getByRole("button", { name: EDIT_LABEL }));
  return (await screen.findByRole("textbox", { name: FIELD_LABEL })) as HTMLTextAreaElement;
}

describe("SobreSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("shows the bio and no empty state when the student has a bio", () => {
    renderSection(BIO);

    expect(screen.getByRole("heading", { name: "Sobre" })).toBeTruthy();
    expect(screen.getByText(BIO)).toBeTruthy();
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
    expect(screen.queryByRole("button", { name: "Escrever sobre" })).toBeNull();
  });

  it("shows the empty state with a call to action when the bio is null", async () => {
    renderSection(null);

    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Escrever sobre" }));

    const field = await screen.findByRole("textbox", { name: FIELD_LABEL });
    expect((field as HTMLTextAreaElement).value).toBe("");
  });

  it("opens the dialog prefilled with the current bio and the character counter", async () => {
    renderSection(BIO);

    const field = await openEditor();

    expect(screen.getByRole("dialog", { name: DIALOG_TITLE })).toBeTruthy();
    expect(field.value).toBe(BIO);
    expect(screen.getByText(`${BIO.length} de ${BIO_MAX} caracteres`)).toBeTruthy();
    expect(screen.getByText("Um resumo profissional ajuda recrutadores a conhecerem seu perfil.")).toBeTruthy();
  });

  it("strips emoji while typing and updates the counter", async () => {
    renderSection(null);
    const field = await openEditor();

    await userEvent.type(field, "Oi \u{1F600}mundo");

    expect(field.value).toBe("Oi mundo");
    expect(screen.getByText(`8 de ${BIO_MAX} caracteres`)).toBeTruthy();
  });

  it("saves the trimmed bio, closes the dialog, refreshes and notifies", async () => {
    updateSobreMock.mockResolvedValue(undefined);
    const props = renderSection(null);
    const field = await openEditor();

    await userEvent.type(field, "  Nova bio  ");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(updateSobreMock).toHaveBeenCalledWith({ bio: "Nova bio" });
    expect(props.notify).toHaveBeenCalledWith(SUCCESS_MESSAGE);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("sends null when the bio is cleared to blank spaces", async () => {
    updateSobreMock.mockResolvedValue(undefined);
    const props = renderSection(BIO);
    const field = await openEditor();

    await userEvent.clear(field);
    await userEvent.type(field, "   ");
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(updateSobreMock).toHaveBeenCalledWith({ bio: null });
  });

  it("shows the API error message and keeps the dialog open on failure", async () => {
    updateSobreMock.mockRejectedValue(new Error("Servidor indisponível"));
    const props = renderSection(BIO);
    await openEditor();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Servidor indisponível");
    expect(screen.getByRole("dialog", { name: DIALOG_TITLE })).toBeTruthy();
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("falls back to the default message when the rejection has no message", async () => {
    updateSobreMock.mockRejectedValue("falha");
    renderSection(BIO);
    await openEditor();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect((await screen.findByRole("alert")).textContent).toBe(FALLBACK_ERROR);
  });

  it("disables the field and shows the saving label while the request is pending", async () => {
    let resolveSave: () => void = () => undefined;
    updateSobreMock.mockImplementation(
      () => new Promise<void>((resolve) => { resolveSave = resolve; })
    );
    const props = renderSection(BIO);
    const field = await openEditor();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByRole("button", { name: "Salvando..." })).toBeTruthy();
    expect(field.disabled).toBe(true);
    resolveSave();
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(updateSobreMock).toHaveBeenCalledTimes(1);
  });

  it("closes the dialog on cancel without saving and reopens with the original bio", async () => {
    renderSection(BIO);
    const field = await openEditor();
    await userEvent.type(field, " extra");

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(updateSobreMock).not.toHaveBeenCalled();

    const reopened = await openEditor();
    expect(reopened.value).toBe(BIO);
  });
});
