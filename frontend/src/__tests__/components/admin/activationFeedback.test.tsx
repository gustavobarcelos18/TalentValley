import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ActivationSnackbar,
  useActivationFeedback,
  type ActivationNotice,
} from "@/components/admin/activationFeedback";
import { adminApi } from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { deferred } from "./adminFixtures";

vi.setConfig({ testTimeout: 15_000 });

vi.mock("@/lib/admin", () => ({
  adminApi: { resendActivation: vi.fn() },
}));

const resendMock = vi.mocked(adminApi.resendActivation);

const USER_ID = "user-1";
const SUCCESS_MESSAGE = "Acesso criado.";
const FAILED_SEND_MESSAGE = "Conta criada, mas não foi possível enviar o email de ativação.";
const AUTO_HIDE_MS = 5000;

function statusError(status: number, message = "erro da API") {
  return new ApiError(status, message);
}

/** Hook already holding the "email could not be sent" warning for USER_ID. */
function renderWithPendingResend() {
  const view = renderHook(() => useActivationFeedback());
  act(() => view.result.current.reportCreated(USER_ID, false, SUCCESS_MESSAGE));
  return view;
}

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("useActivationFeedback", () => {
  it("starts without a notice", () => {
    const { result } = renderHook(() => useActivationFeedback());

    expect(result.current.notice).toBeNull();
    expect(result.current.resendBusy).toBe(false);
  });

  it("reports a success notice when the activation email was sent", () => {
    const { result } = renderHook(() => useActivationFeedback());

    act(() => result.current.reportCreated(USER_ID, true, SUCCESS_MESSAGE));

    expect(result.current.notice).toEqual({ message: SUCCESS_MESSAGE, severity: "success", resendId: null });
  });

  it("reports a warning with the user id to resend when the email was not sent", () => {
    const { result } = renderWithPendingResend();

    expect(result.current.notice).toEqual({ message: FAILED_SEND_MESSAGE, severity: "warning", resendId: USER_ID });
  });

  it("lets the caller replace or clear the notice", () => {
    const { result } = renderWithPendingResend();

    act(() => result.current.setNotice(null));

    expect(result.current.notice).toBeNull();
  });

  it("does nothing when resending without a notice", async () => {
    const { result } = renderHook(() => useActivationFeedback());

    await act(() => result.current.resend());

    expect(resendMock).not.toHaveBeenCalled();
    expect(result.current.notice).toBeNull();
  });

  it("does nothing when the notice has nothing to resend", async () => {
    const { result } = renderHook(() => useActivationFeedback());
    act(() => result.current.reportCreated(USER_ID, true, SUCCESS_MESSAGE));

    await act(() => result.current.resend());

    expect(resendMock).not.toHaveBeenCalled();
    expect(result.current.notice?.message).toBe(SUCCESS_MESSAGE);
  });

  it("resends the activation and reports success", async () => {
    resendMock.mockResolvedValue(undefined);
    const { result } = renderWithPendingResend();

    await act(() => result.current.resend());

    expect(resendMock).toHaveBeenCalledWith(USER_ID);
    expect(result.current.notice).toEqual({ message: "Email de ativação reenviado.", severity: "success", resendId: null });
    expect(result.current.resendBusy).toBe(false);
  });

  it("is busy while resending and ignores a second request in the meantime", async () => {
    const pending = deferred<void>();
    resendMock.mockReturnValue(pending.promise);
    const { result } = renderWithPendingResend();

    act(() => {
      void result.current.resend();
    });
    expect(result.current.resendBusy).toBe(true);
    await act(() => result.current.resend());
    expect(resendMock).toHaveBeenCalledTimes(1);

    await act(async () => pending.resolve());
    expect(result.current.resendBusy).toBe(false);
    expect(result.current.notice?.severity).toBe("success");
  });

  it.each([
    { status: 409, message: "A conta já foi ativada.", severity: "info" },
    { status: 404, message: "Usuário não encontrado.", severity: "error" },
  ])("reports $message when the API answers $status", async ({ status, message, severity }) => {
    resendMock.mockRejectedValue(statusError(status));
    const { result } = renderWithPendingResend();

    await act(() => result.current.resend());

    expect(result.current.notice).toEqual({ message, severity, resendId: null });
    expect(result.current.resendBusy).toBe(false);
  });

  it("keeps the resend option when the sending service is unavailable", async () => {
    resendMock.mockRejectedValue(statusError(503));
    const { result } = renderWithPendingResend();

    await act(() => result.current.resend());

    expect(result.current.notice).toEqual({
      message: "O envio ainda está indisponível. Tente novamente mais tarde.",
      severity: "warning",
      resendId: USER_ID,
    });
  });

  it("shows the API message for other API failures", async () => {
    resendMock.mockRejectedValue(statusError(500, "Falha no servidor"));
    const { result } = renderWithPendingResend();

    await act(() => result.current.resend());

    expect(result.current.notice).toEqual({ message: "Falha no servidor", severity: "error", resendId: null });
  });

  it.each([
    { label: "a non-error value", cause: "boom" as unknown },
    { label: "null", cause: null as unknown },
  ])("falls back to the default message for $label", async ({ cause }) => {
    resendMock.mockRejectedValue(cause);
    const { result } = renderWithPendingResend();

    await act(() => result.current.resend());

    expect(result.current.notice).toEqual({
      message: "Não foi possível reenviar a ativação.",
      severity: "error",
      resendId: null,
    });
  });
});

describe("ActivationSnackbar", () => {
  function renderSnackbar(notice: ActivationNotice | null, busy = false) {
    const onClose = vi.fn();
    const onResend = vi.fn();
    render(<ActivationSnackbar notice={notice} busy={busy} onClose={onClose} onResend={onResend} />);
    return { onClose, onResend };
  }

  it("renders nothing without a notice", () => {
    renderSnackbar(null);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the message without a resend button when there is nothing to resend", () => {
    renderSnackbar({ message: SUCCESS_MESSAGE, severity: "success", resendId: null });

    expect(screen.getByRole("alert").textContent).toContain(SUCCESS_MESSAGE);
    expect(screen.queryByRole("button", { name: "Reenviar ativação" })).toBeNull();
  });

  it("offers to resend the activation and reports the click", async () => {
    const user = userEvent.setup();
    const { onResend } = renderSnackbar({ message: FAILED_SEND_MESSAGE, severity: "warning", resendId: USER_ID });

    await user.click(screen.getByRole("button", { name: "Reenviar ativação" }));

    expect(onResend).toHaveBeenCalledTimes(1);
  });

  it("disables the resend button while busy", () => {
    renderSnackbar({ message: FAILED_SEND_MESSAGE, severity: "warning", resendId: USER_ID }, true);

    const button = screen.getByRole("button", { name: "Reenviando..." }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("asks to close when the user presses Escape", async () => {
    const user = userEvent.setup();
    const { onClose } = renderSnackbar({ message: SUCCESS_MESSAGE, severity: "success", resendId: null });

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("closes by itself after five seconds when there is nothing to resend", () => {
    vi.useFakeTimers();
    const { onClose } = renderSnackbar({ message: SUCCESS_MESSAGE, severity: "success", resendId: null });

    act(() => {
      vi.advanceTimersByTime(AUTO_HIDE_MS - 1);
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open while the user can still resend the activation", () => {
    vi.useFakeTimers();
    const { onClose } = renderSnackbar({ message: FAILED_SEND_MESSAGE, severity: "warning", resendId: USER_ID });

    act(() => {
      vi.advanceTimersByTime(AUTO_HIDE_MS * 4);
    });

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeTruthy();
  });
});
