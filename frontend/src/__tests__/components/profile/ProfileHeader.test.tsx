import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { notifyPhotoChange } from "@/lib/photoSync";
import { deleteStudentPhoto, uploadStudentPhoto } from "@/lib/student";
import { makeSectionProps } from "./profileFixtures";

interface ProtectedFileResult {
  url: string | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const reloadMock = vi.fn();
let protectedFile: ProtectedFileResult;
const requestedPaths: Array<string | null> = [];

vi.mock("@/hooks/useProtectedFile", () => ({
  useProtectedFile: (path: string | null): ProtectedFileResult => {
    requestedPaths.push(path);
    return protectedFile;
  },
}));

vi.mock("@/lib/student", () => ({
  uploadStudentPhoto: vi.fn(),
  deleteStudentPhoto: vi.fn(),
}));

vi.mock("@/lib/photoSync", () => ({
  notifyPhotoChange: vi.fn(),
}));

const uploadMock = vi.mocked(uploadStudentPhoto);
const deleteMock = vi.mocked(deleteStudentPhoto);
const notifyPhotoChangeMock = vi.mocked(notifyPhotoChange);

const PHOTO_PATH = "/api/alunos/me/foto";
const FILE_INPUT_LABEL = "Selecionar foto de perfil";
const ADD_LABEL = "Adicionar foto de perfil";
const CHANGE_LABEL = "Alterar foto de perfil";
const REMOVE_BUTTON = "Remover foto";
const DIALOG_TITLE = "Remover foto de perfil?";
const MAX_BYTES = 5 * 1024 * 1024;
const INVALID_SIGNATURE = "O arquivo selecionado não é uma imagem JPEG, PNG ou WebP válida.";
const UPLOAD_FALLBACK = "Não foi possível enviar a foto. Tente novamente.";
const REMOVE_FALLBACK = "Não foi possível remover a foto. Tente novamente.";

const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0];
const PNG_BYTES = [137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0];
const GARBAGE_BYTES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function makeFile(name: string, type: string, bytes: number[]): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function makeOversizedFile(): File {
  const file = makeFile("foto.png", "image/png", PNG_BYTES);
  Object.defineProperty(file, "size", { value: MAX_BYTES + 1 });
  return file;
}

function renderHeader(overrides: Parameters<typeof makeSectionProps>[0] = {}) {
  const props = makeSectionProps(overrides);
  render(<ProfileHeader {...props} />);
  return props;
}

function withPhoto() {
  const props = makeSectionProps({
    dadosBasicos: { nomeCompleto: "Maria Souza", fotoUrl: PHOTO_PATH, cidade: "Rio Pomba", uf: "MG" },
  });
  render(<ProfileHeader {...props} />);
  return props;
}

function fileInput(): HTMLInputElement {
  return screen.getByLabelText(FILE_INPUT_LABEL) as HTMLInputElement;
}

async function uploadFile(file: File) {
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(fileInput(), file);
}

describe("ProfileHeader", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    protectedFile = { url: null, loading: false, error: null, reload: reloadMock };
    requestedPaths.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("identity", () => {
    it("shows name, initials, location and the last update", () => {
      renderHeader();

      expect(screen.getByRole("heading", { level: 1, name: "Maria Souza" })).toBeTruthy();
      expect(screen.getByText("MS")).toBeTruthy();
      expect(screen.getByText("Rio Pomba - MG")).toBeTruthy();
      expect(screen.getByText(/Perfil atualizado em \d{2}\/\d{2}\/\d{4}/)).toBeTruthy();
    });

    it("shows only the city or only the state when the other is missing", () => {
      const { unmount } = render(
        <ProfileHeader
          {...makeSectionProps({
            dadosBasicos: { nomeCompleto: "Maria Souza", fotoUrl: null, cidade: "Rio Pomba", uf: "" },
          })}
        />
      );
      expect(screen.getByText("Rio Pomba")).toBeTruthy();
      unmount();

      renderHeader({
        dadosBasicos: { nomeCompleto: "Maria Souza", fotoUrl: null, cidade: "", uf: "MG" },
      });
      expect(screen.getByText("MG")).toBeTruthy();
    });

    it("shows a placeholder when no location is known", () => {
      renderHeader({
        dadosBasicos: { nomeCompleto: "Maria Souza", fotoUrl: null, cidade: "", uf: "" },
      });

      expect(screen.getByText("Localização não informada")).toBeTruthy();
    });

    it("passes the photo path to the protected file hook and renders the loaded image", () => {
      protectedFile = { ...protectedFile, url: "blob:foto-1" };
      withPhoto();

      expect(requestedPaths).toContain(PHOTO_PATH);
      const image = document.querySelector("img.MuiAvatar-img") as HTMLImageElement;
      expect(image.getAttribute("src")).toBe("blob:foto-1");
    });

    it("shows a spinner while the photo is loading", () => {
      protectedFile = { ...protectedFile, loading: true };
      withPhoto();

      expect(document.querySelector(".MuiCircularProgress-root")).not.toBeNull();
    });

    it("does not show a spinner when the photo is not loading", () => {
      withPhoto();

      expect(document.querySelector(".MuiCircularProgress-root")).toBeNull();
    });

    it("shows the load error from the protected file hook as an alert", () => {
      protectedFile = { ...protectedFile, error: "Não foi possível carregar o arquivo." };
      withPhoto();

      expect(screen.getByRole("alert").textContent).toBe("Não foi possível carregar o arquivo.");
    });
  });

  describe("photo actions visibility", () => {
    it("offers to add a photo and hides the remove button when there is no photo", () => {
      renderHeader();

      expect(screen.getByRole("button", { name: ADD_LABEL })).toBeTruthy();
      expect(screen.queryByRole("button", { name: REMOVE_BUTTON })).toBeNull();
    });

    it("offers to change and remove the photo when one exists", () => {
      withPhoto();

      expect(screen.getByRole("button", { name: CHANGE_LABEL })).toBeTruthy();
      expect(screen.getByRole("button", { name: REMOVE_BUTTON })).toBeTruthy();
    });

    it("opens the hidden file input from the camera button", async () => {
      const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);
      renderHeader();

      await userEvent.click(screen.getByRole("button", { name: ADD_LABEL }));

      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(fileInput().accept).toBe("image/jpeg,image/png,image/webp");
    });
  });

  describe("photo validation", () => {
    it("ignores a change event without a file", () => {
      renderHeader();

      fireEvent.change(fileInput(), { target: { files: [] } });

      expect(screen.queryByRole("alert")).toBeNull();
      expect(uploadMock).not.toHaveBeenCalled();
    });

    // WebP: only rejection cases are covered here; there is intentionally no valid-WebP upload case.
    it.each([
      ["an unsupported extension", makeFile("foto.gif", "image/gif", GARBAGE_BYTES), "Use uma foto nos formatos JPEG, PNG ou WebP."],
      ["no extension", makeFile("foto", "image/png", PNG_BYTES), "Use uma foto nos formatos JPEG, PNG ou WebP."],
      [
        "a mime type that does not match the extension",
        makeFile("foto.png", "image/jpeg", PNG_BYTES),
        "O formato informado não corresponde ao arquivo de imagem selecionado.",
      ],
      ["an empty file", makeFile("foto.jpg", "image/jpeg", []), "O arquivo de imagem está vazio."],
      ["a file above 5 MB", makeOversizedFile(), "A foto deve ter no máximo 5 MB."],
      ["a jpeg with a wrong signature", makeFile("foto.jpg", "image/jpeg", GARBAGE_BYTES), INVALID_SIGNATURE],
      ["a jpeg shorter than its signature", makeFile("foto.jpeg", "image/jpeg", [0xff, 0xd8]), INVALID_SIGNATURE],
      ["a png with a wrong signature", makeFile("foto.png", "image/png", GARBAGE_BYTES), INVALID_SIGNATURE],
      ["a png shorter than its signature", makeFile("foto.png", "image/png", [137, 80]), INVALID_SIGNATURE],
      ["a webp with a wrong signature", makeFile("foto.webp", "image/webp", GARBAGE_BYTES), INVALID_SIGNATURE],
      ["a webp shorter than its signature", makeFile("foto.webp", "image/webp", [0x52, 0x49, 0x46, 0x46]), INVALID_SIGNATURE],
    ])("rejects %s without calling the API", async (_label, file, message) => {
      renderHeader();

      await uploadFile(file);

      expect((await screen.findByRole("alert")).textContent).toBe(message);
      expect(uploadMock).not.toHaveBeenCalled();
    });

    it("resets the input so the same file can be picked again", async () => {
      renderHeader();
      const input = fileInput();

      await uploadFile(makeFile("foto.gif", "image/gif", GARBAGE_BYTES));

      await screen.findByRole("alert");
      expect(input.value).toBe("");
    });
  });

  describe("photo upload", () => {
    it.each([
      ["jpg", "image/jpeg", JPEG_BYTES],
      ["jpeg", "image/jpeg", JPEG_BYTES],
      ["png", "image/png", PNG_BYTES],
    ])("uploads a valid .%s file and propagates the change", async (extension, type, bytes) => {
      uploadMock.mockResolvedValue(undefined);
      const props = renderHeader();
      const file = makeFile(`Foto.${extension.toUpperCase()}`, type, bytes);

      await uploadFile(file);

      await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Foto atualizada."));
      expect(uploadMock).toHaveBeenCalledWith(file);
      expect(props.onChanged).toHaveBeenCalledTimes(1);
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(notifyPhotoChangeMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("clears a previous validation error when a valid file is chosen", async () => {
      uploadMock.mockResolvedValue(undefined);
      const props = renderHeader();
      await uploadFile(makeFile("foto.gif", "image/gif", GARBAGE_BYTES));
      await screen.findByRole("alert");

      await uploadFile(makeFile("foto.png", "image/png", PNG_BYTES));

      await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Foto atualizada."));
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("shows progress and disables the photo actions while uploading", async () => {
      let resolveUpload: () => void = () => undefined;
      uploadMock.mockImplementation(() => new Promise<void>((resolve) => { resolveUpload = resolve; }));
      const props = withPhoto();

      await uploadFile(makeFile("foto.png", "image/png", PNG_BYTES));

      expect(await screen.findByText("Enviando foto...")).toBeTruthy();
      expect((screen.getByRole("button", { name: CHANGE_LABEL }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole("button", { name: REMOVE_BUTTON }) as HTMLButtonElement).disabled).toBe(true);

      resolveUpload();
      await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Foto atualizada."));
      expect(screen.queryByText("Enviando foto...")).toBeNull();
      expect((screen.getByRole("button", { name: CHANGE_LABEL }) as HTMLButtonElement).disabled).toBe(false);
    });

    it("shows the API error message when the upload fails", async () => {
      uploadMock.mockRejectedValue(new Error("Arquivo recusado pelo servidor"));
      const props = renderHeader();

      await uploadFile(makeFile("foto.png", "image/png", PNG_BYTES));

      expect((await screen.findByRole("alert")).textContent).toBe("Arquivo recusado pelo servidor");
      expect(props.onChanged).not.toHaveBeenCalled();
      expect(props.notify).not.toHaveBeenCalled();
      expect(notifyPhotoChangeMock).not.toHaveBeenCalled();
      expect(screen.queryByText("Enviando foto...")).toBeNull();
    });

    it("falls back to the default message when the upload rejection has no message", async () => {
      uploadMock.mockRejectedValue("falha");
      renderHeader();

      await uploadFile(makeFile("foto.png", "image/png", PNG_BYTES));

      expect((await screen.findByRole("alert")).textContent).toBe(UPLOAD_FALLBACK);
    });
  });

  describe("photo removal", () => {
    it("opens a confirmation dialog and closes it with Cancelar without calling the API", async () => {
      withPhoto();

      await userEvent.click(screen.getByRole("button", { name: REMOVE_BUTTON }));
      expect(await screen.findByRole("dialog", { name: DIALOG_TITLE })).toBeTruthy();
      expect(screen.getByText(/A foto atual será removida do seu perfil/)).toBeTruthy();

      await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it("closes the confirmation dialog with Escape while idle", async () => {
      withPhoto();
      await userEvent.click(screen.getByRole("button", { name: REMOVE_BUTTON }));
      await screen.findByRole("dialog", { name: DIALOG_TITLE });

      await userEvent.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(deleteMock).not.toHaveBeenCalled();
    });

    it("removes the photo, propagates the change and closes the dialog", async () => {
      deleteMock.mockResolvedValue(undefined);
      const props = withPhoto();
      await userEvent.click(screen.getByRole("button", { name: REMOVE_BUTTON }));
      const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });

      await userEvent.click(within(dialog).getByRole("button", { name: REMOVE_BUTTON }));

      await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Foto removida."));
      expect(deleteMock).toHaveBeenCalledTimes(1);
      expect(props.onChanged).toHaveBeenCalledTimes(1);
      expect(reloadMock).toHaveBeenCalledTimes(1);
      expect(notifyPhotoChangeMock).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("blocks closing and shows the removing label while the request is pending", async () => {
      let resolveDelete: () => void = () => undefined;
      deleteMock.mockImplementation(() => new Promise<void>((resolve) => { resolveDelete = resolve; }));
      const props = withPhoto();
      await userEvent.click(screen.getByRole("button", { name: REMOVE_BUTTON }));
      const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });

      await userEvent.click(within(dialog).getByRole("button", { name: REMOVE_BUTTON }));

      const busy = (await screen.findByRole("button", { name: "Removendo..." })) as HTMLButtonElement;
      expect(busy.disabled).toBe(true);
      expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
      await userEvent.keyboard("{Escape}");
      expect(screen.getByRole("dialog")).toBeTruthy();

      resolveDelete();
      await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Foto removida."));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("shows the API error and closes the dialog when the removal fails", async () => {
      deleteMock.mockRejectedValue(new Error("Falha no servidor"));
      const props = withPhoto();
      await userEvent.click(screen.getByRole("button", { name: REMOVE_BUTTON }));
      const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });

      await userEvent.click(within(dialog).getByRole("button", { name: REMOVE_BUTTON }));

      expect((await screen.findByRole("alert")).textContent).toBe("Falha no servidor");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(props.onChanged).not.toHaveBeenCalled();
      expect(props.notify).not.toHaveBeenCalled();
      expect(notifyPhotoChangeMock).not.toHaveBeenCalled();
    });

    it("falls back to the default message when the removal rejection has no message", async () => {
      deleteMock.mockRejectedValue("falha");
      withPhoto();
      await userEvent.click(screen.getByRole("button", { name: REMOVE_BUTTON }));
      const dialog = await screen.findByRole("dialog", { name: DIALOG_TITLE });

      await userEvent.click(within(dialog).getByRole("button", { name: REMOVE_BUTTON }));

      expect((await screen.findByRole("alert")).textContent).toBe(REMOVE_FALLBACK);
    });
  });
});
