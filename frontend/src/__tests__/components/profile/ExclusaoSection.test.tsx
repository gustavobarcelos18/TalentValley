import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { ExclusaoSection } from "@/components/profile/ExclusaoSection";
import { deleteOwnAccount } from "@/lib/student";

const replaceMock = vi.fn();
const logoutMock = vi.fn<() => Promise<void>>();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ logout: logoutMock }),
}));

vi.mock("@/lib/student", () => ({
  deleteOwnAccount: vi.fn(),
}));

const deleteOwnAccountMock = vi.mocked(deleteOwnAccount);

const OPEN_BUTTON = "Excluir minha conta";
const CONFIRM_BUTTON = "Excluir definitivamente";
const PASSWORD_LABEL = /Senha atual/;
const PASSWORD = "SenhaForte#1";
const REDIRECT_DELAY_MS = 2000;
const SUCCESS_TEXT = "Sua conta foi deletada com sucesso. Redirecionando...";
const FALLBACK_ERROR = "Não foi possível excluir a conta. Tente novamente.";

function setup() {
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

async function openDialog(user: ReturnType<typeof setup>) {
  await user.click(screen.getByRole("button", { name: OPEN_BUTTON }));
  return (await screen.findByLabelText(PASSWORD_LABEL)) as HTMLInputElement;
}

async function typeAndConfirm(user: ReturnType<typeof setup>) {
  const field = await openDialog(user);
  await user.type(field, PASSWORD);
  await user.click(screen.getByRole("button", { name: CONFIRM_BUTTON }));
  return field;
}

async function advanceRedirect() {
  await act(async () => {
    vi.advanceTimersByTime(REDIRECT_DELAY_MS);
  });
}

describe("ExclusaoSection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    logoutMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the danger zone with the irreversible warning and no dialog", () => {
    render(<ExclusaoSection />);

    expect(screen.getByRole("heading", { level: 2, name: "Excluir conta" })).toBeTruthy();
    expect(screen.getByText(/Esta ação é irreversível/)).toBeTruthy();
    expect(screen.getByRole("button", { name: OPEN_BUTTON })).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the confirmation dialog with an empty password field", async () => {
    const user = setup();
    render(<ExclusaoSection />);

    const field = await openDialog(user);

    expect(screen.getByRole("dialog", { name: OPEN_BUTTON })).toBeTruthy();
    expect(field.value).toBe("");
    expect(field.type).toBe("password");
    expect(field.maxLength).toBe(1024);
  });

  it("asks for the password when submitting empty and does not call the API", async () => {
    const user = setup();
    render(<ExclusaoSection />);
    await openDialog(user);

    await user.click(screen.getByRole("button", { name: CONFIRM_BUTTON }));

    expect((await screen.findByRole("alert")).textContent).toBe("Informe sua senha para confirmar.");
    expect(deleteOwnAccountMock).not.toHaveBeenCalled();
  });

  it("clears the password and error when the dialog is cancelled", async () => {
    const user = setup();
    render(<ExclusaoSection />);
    const field = await openDialog(user);
    await user.click(screen.getByRole("button", { name: CONFIRM_BUTTON }));
    await screen.findByRole("alert");
    await user.type(field, PASSWORD);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const reopened = await openDialog(user);
    expect(reopened.value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(deleteOwnAccountMock).not.toHaveBeenCalled();
  });

  it("deletes the account with the typed password, shows success and redirects after the delay", async () => {
    deleteOwnAccountMock.mockResolvedValue(undefined);
    const user = setup();
    render(<ExclusaoSection />);

    await typeAndConfirm(user);

    expect((await screen.findByRole("status")).textContent).toBe(SUCCESS_TEXT);
    // Checked right after the success message, before any waitFor lets the auto-advancing clock run.
    expect(replaceMock).not.toHaveBeenCalled();
    expect(deleteOwnAccountMock).toHaveBeenCalledWith(PASSWORD);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.queryByRole("button", { name: OPEN_BUTTON })).toBeNull();

    await advanceRedirect();

    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it("swallows a failing logout after the redirect", async () => {
    deleteOwnAccountMock.mockResolvedValue(undefined);
    logoutMock.mockRejectedValue(new Error("logout falhou"));
    const user = setup();
    render(<ExclusaoSection />);
    await typeAndConfirm(user);
    await screen.findByRole("status");

    await advanceRedirect();

    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(logoutMock).toHaveBeenCalledTimes(1);
  });

  it("shows the problem title for an ApiError and keeps the dialog open", async () => {
    deleteOwnAccountMock.mockRejectedValue(new ApiError(400, "Bad Request", { title: "Senha incorreta." }));
    const user = setup();
    render(<ExclusaoSection />);

    const field = await typeAndConfirm(user);

    expect((await screen.findByRole("alert")).textContent).toBe("Senha incorreta.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(field.value).toBe(PASSWORD);
    expect(screen.queryByRole("status")).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("falls back to the default message when the rejection carries no message", async () => {
    deleteOwnAccountMock.mockRejectedValue("falha");
    const user = setup();
    render(<ExclusaoSection />);

    await typeAndConfirm(user);

    expect((await screen.findByRole("alert")).textContent).toBe(FALLBACK_ERROR);
  });

  it("disables the form and blocks closing while the deletion is pending", async () => {
    let resolveDelete: () => void = () => undefined;
    deleteOwnAccountMock.mockImplementation(
      () => new Promise<void>((resolve) => { resolveDelete = resolve; })
    );
    const user = setup();
    const { unmount } = render(<ExclusaoSection />);

    const field = await typeAndConfirm(user);

    const busyButton = (await screen.findByRole("button", { name: "Excluindo..." })) as HTMLButtonElement;
    expect(busyButton.disabled).toBe(true);
    expect(field.disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(deleteOwnAccountMock).toHaveBeenCalledTimes(1);

    resolveDelete();
    await screen.findByRole("status");
    expect(replaceMock).not.toHaveBeenCalled();
    unmount();
  });

  it("cancels the pending redirect when the section unmounts", async () => {
    deleteOwnAccountMock.mockResolvedValue(undefined);
    const user = setup();
    const { unmount } = render(<ExclusaoSection />);
    await typeAndConfirm(user);
    await screen.findByRole("status");
    expect(replaceMock).not.toHaveBeenCalled();

    unmount();
    await advanceRedirect();

    expect(replaceMock).not.toHaveBeenCalled();
    expect(logoutMock).not.toHaveBeenCalled();
  });
});
