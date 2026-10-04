import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { CurriculoSection } from "@/components/profile/CurriculoSection";
import { ApiError, apiDownload } from "@/lib/api";
import { deleteStudentCurriculum, uploadStudentCurriculum } from "@/lib/student";
import { deferred, makeSectionProps } from "./profileFixtures";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiDownload: vi.fn(),
}));
vi.mock("@/lib/student");

const FILE_INPUT_LABEL = "Selecionar currículo em PDF";
const PDF_TYPE = "application/pdf";
const PDF_NAME = "curriculo.pdf";
const DOWNLOAD_FILE_NAME = "curriculo.pdf";
const STORED_FILE_NAME = "meu-cv-2026.pdf";
const OBJECT_URL = "blob:curriculo-temporario";
const UPLOAD_ERROR_FALLBACK = "Não foi possível enviar o currículo. Tente novamente.";
const DOWNLOAD_ERROR_FALLBACK = "Não foi possível baixar o currículo. Tente novamente.";
const DELETE_ERROR_FALLBACK = "Não foi possível remover o currículo. Tente novamente.";
const NOTIFY_UPLOADED = "Currículo enviado.";
const NOTIFY_DELETED = "Currículo removido.";
const DELETE_DIALOG_TITLE = "Excluir currículo?";
const MAX_BYTES = 10 * 1024 * 1024;

const uploadMock = vi.mocked(uploadStudentCurriculum);
const deleteMock = vi.mocked(deleteStudentCurriculum);
const downloadMock = vi.mocked(apiDownload);

let createObjectURL: MockInstance<typeof URL.createObjectURL>;
let revokeObjectURL: MockInstance<typeof URL.revokeObjectURL>;

beforeEach(() => {
  vi.resetAllMocks();
  createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue(OBJECT_URL);
  revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function pdfFile(name = PDF_NAME, type = PDF_TYPE) {
  return new File(["%PDF-1.7 conteudo"], name, { type });
}

function renderSection(possuiCurriculo: boolean, nomeArquivo = PDF_NAME) {
  const props = makeSectionProps({
    curriculo: { possuiCurriculo, nomeArquivo: possuiCurriculo ? nomeArquivo : null },
  });
  render(<CurriculoSection {...props} />);
  return props;
}

function fileInput() {
  return screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
}

describe("CurriculoSection", () => {
  it("shows the empty state with only the upload action when there is no curriculum", () => {
    renderSection(false);

    expect(screen.getByRole("heading", { name: "Currículo" })).toBeTruthy();
    expect(screen.getByText(/Nenhum currículo enviado ainda/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Enviar currículo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Baixar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
  });

  it("shows download, replace and delete actions when a curriculum exists", () => {
    renderSection(true);

    expect(screen.getByText("Currículo em PDF")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Baixar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Substituir" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Excluir" })).toBeTruthy();
    expect(screen.queryByText(/Nenhum currículo enviado ainda/)).toBeNull();
  });

  it("opens the native file picker from the upload and replace buttons", async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
    const { unmount } = render(<CurriculoSection {...makeSectionProps()} />);

    await user.click(screen.getByRole("button", { name: "Enviar currículo" }));
    expect(click).toHaveBeenCalledTimes(1);
    unmount();

    renderSection(true);
    await user.click(screen.getByRole("button", { name: "Substituir" }));
    expect(click).toHaveBeenCalledTimes(2);
  });

  it("uploads a valid PDF, then reports the change", async () => {
    const user = userEvent.setup();
    uploadMock.mockResolvedValue(undefined);
    const props = renderSection(false);
    const file = pdfFile();

    await user.upload(fileInput(), file);

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith(NOTIFY_UPLOADED));
    expect(uploadMock).toHaveBeenCalledWith(file);
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the progress message and disables actions while the upload is pending", async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    uploadMock.mockReturnValue(pending.promise);
    const props = renderSection(true);

    await user.upload(fileInput(), pdfFile());

    expect(await screen.findByText("Enviando currículo...")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Baixar" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Substituir" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Excluir" }) as HTMLButtonElement).disabled).toBe(true);

    pending.resolve();
    await waitFor(() => expect(props.notify).toHaveBeenCalledWith(NOTIFY_UPLOADED));
    expect(screen.queryByText("Enviando currículo...")).toBeNull();
  });

  it("ignores a change event that carries no file", () => {
    renderSection(false);

    fireEvent.change(fileInput(), { target: { files: [] } });

    expect(uploadMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  const invalidFiles: [string, () => File, string][] = [
    ["a file without the .pdf extension", () => pdfFile("curriculo.txt", ""), "Envie um arquivo PDF."],
    ["a file declared with a non-PDF MIME type", () => pdfFile(PDF_NAME, "text/plain"), "O arquivo selecionado não é um PDF válido."],
    ["an empty PDF", () => new File([], PDF_NAME, { type: PDF_TYPE }), "O arquivo PDF está vazio."],
    [
      "a PDF larger than 10 MB",
      () => new File([new Uint8Array(MAX_BYTES + 1)], PDF_NAME, { type: PDF_TYPE }),
      "O currículo deve ter no máximo 10 MB.",
    ],
    [
      "a file whose content lacks the PDF signature",
      () => new File(["conteudo que nao e pdf"], PDF_NAME, { type: PDF_TYPE }),
      "O arquivo selecionado não é um PDF válido.",
    ],
    [
      "a file shorter than the PDF signature",
      () => new File(["%PD"], PDF_NAME, { type: PDF_TYPE }),
      "O arquivo selecionado não é um PDF válido.",
    ],
  ];

  it.each(invalidFiles)("rejects %s without calling the API", async (_label, build, message) => {
    const user = userEvent.setup({ applyAccept: false });
    const props = renderSection(false);

    await user.upload(fileInput(), build());

    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(uploadMock).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("accepts a PDF with an uppercase extension and no declared MIME type", async () => {
    const user = userEvent.setup({ applyAccept: false });
    uploadMock.mockResolvedValue(undefined);
    const props = renderSection(false);

    await user.upload(fileInput(), pdfFile("CURRICULO.PDF", ""));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith(NOTIFY_UPLOADED));
  });

  it("shows the API error title when the upload fails and keeps the profile untouched", async () => {
    const user = userEvent.setup();
    uploadMock.mockRejectedValue(new ApiError(413, "Arquivo grande", { title: "Arquivo grande demais para o servidor" }));
    const props = renderSection(false);

    await user.upload(fileInput(), pdfFile());

    expect((await screen.findByRole("alert")).textContent).toBe("Arquivo grande demais para o servidor");
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
    expect(screen.queryByText("Enviando currículo...")).toBeNull();
  });

  it("falls back to the generic upload message when the rejection carries no message", async () => {
    const user = userEvent.setup();
    uploadMock.mockRejectedValue("falha");
    renderSection(false);

    await user.upload(fileInput(), pdfFile());

    expect((await screen.findByRole("alert")).textContent).toBe(UPLOAD_ERROR_FALLBACK);
  });

  it("clears a previous error when a new upload starts", async () => {
    const user = userEvent.setup({ applyAccept: false });
    uploadMock.mockResolvedValue(undefined);
    renderSection(false);

    await user.upload(fileInput(), pdfFile("curriculo.txt", ""));
    expect(await screen.findByRole("alert")).toBeTruthy();

    await user.upload(fileInput(), pdfFile());

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("downloads the curriculum through a temporary object URL and revokes it", async () => {
    const user = userEvent.setup();
    const blob = new Blob(["%PDF-1.7"], { type: PDF_TYPE });
    downloadMock.mockResolvedValue(blob);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderSection(true, STORED_FILE_NAME);

    await user.click(screen.getByRole("button", { name: "Baixar" }));

    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL));
    expect(downloadMock).toHaveBeenCalledWith("/api/alunos/me/curriculo");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe(DOWNLOAD_FILE_NAME);
    expect(anchor.href).toBe(OBJECT_URL);
    expect(document.querySelector("a[download]")).toBeNull();
    expect((screen.getByRole("button", { name: "Baixar" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("disables every action while the download is pending", async () => {
    const user = userEvent.setup();
    const pending = deferred<Blob>();
    downloadMock.mockReturnValue(pending.promise);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    renderSection(true);

    await user.click(screen.getByRole("button", { name: "Baixar" }));

    await waitFor(() => expect((screen.getByRole("button", { name: "Baixar" }) as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByRole("button", { name: "Excluir" }) as HTMLButtonElement).disabled).toBe(true);

    pending.resolve(new Blob(["%PDF-1.7"]));
    await waitFor(() => expect((screen.getByRole("button", { name: "Baixar" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("shows the API error when the download fails", async () => {
    const user = userEvent.setup();
    downloadMock.mockRejectedValue(new ApiError(404, "Não encontrado", { title: "Currículo não encontrado" }));
    renderSection(true);

    await user.click(screen.getByRole("button", { name: "Baixar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Currículo não encontrado");
    expect(createObjectURL).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Baixar" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("falls back to the generic download message for an opaque failure", async () => {
    const user = userEvent.setup();
    downloadMock.mockRejectedValue(null);
    renderSection(true);

    await user.click(screen.getByRole("button", { name: "Baixar" }));

    expect((await screen.findByRole("alert")).textContent).toBe(DOWNLOAD_ERROR_FALLBACK);
  });

  it("asks for confirmation before deleting and closes the dialog on cancel", async () => {
    const user = userEvent.setup();
    renderSection(true);
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    expect(screen.getByRole("dialog", { name: DELETE_DIALOG_TITLE })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("deletes the curriculum after confirmation, then reports the change", async () => {
    const user = userEvent.setup();
    deleteMock.mockResolvedValue(undefined);
    const props = renderSection(true);

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getByRole("button", { name: "Excluir currículo" }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith(NOTIFY_DELETED));
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("locks the dialog buttons and shows the progress label while deleting", async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    deleteMock.mockReturnValue(pending.promise);
    renderSection(true);

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getByRole("button", { name: "Excluir currículo" }));

    const removing = await screen.findByRole("button", { name: "Excluindo..." });
    expect((removing as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);

    pending.resolve();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows the API error and closes the dialog when the deletion fails", async () => {
    const user = userEvent.setup();
    deleteMock.mockRejectedValue(new ApiError(500, "Erro interno", { title: "Falha ao excluir no servidor" }));
    const props = renderSection(true);

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getByRole("button", { name: "Excluir currículo" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Falha ao excluir no servidor");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("falls back to the generic delete message for an opaque failure", async () => {
    const user = userEvent.setup();
    deleteMock.mockRejectedValue(undefined);
    renderSection(true);

    await user.click(screen.getByRole("button", { name: "Excluir" }));
    await user.click(screen.getByRole("button", { name: "Excluir currículo" }));

    expect((await screen.findByRole("alert")).textContent).toBe(DELETE_ERROR_FALLBACK);
  });
});
