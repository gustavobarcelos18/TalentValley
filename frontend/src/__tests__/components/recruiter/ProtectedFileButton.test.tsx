import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedFileButton } from "@/components/recruiter/ProtectedFileButton";
import { ApiError, apiDownload } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiDownload: vi.fn(),
}));

const downloadMock = vi.mocked(apiDownload);

const PATH = "/api/recrutador/talentos/maria/curriculo";
const LABEL = "Abrir currículo";
const OBJECT_URL = "blob:talent-valley/abc";
const FALLBACK = "Não foi possível abrir o arquivo.";
const REVOKE_DELAY_MS = 60_000;
const FORBIDDEN = 403;

const createObjectURL = vi.fn(() => OBJECT_URL);
const revokeObjectURL = vi.fn();
let clickedAnchors: HTMLAnchorElement[] = [];
let clickSpy: { mock: { calls: unknown[][] } };

function isDisabled(): boolean {
  return (screen.getByRole("button", { name: LABEL }) as HTMLButtonElement).disabled;
}

beforeEach(() => {
  clickedAnchors = [];
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true });
  clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clickedAnchors.push(this);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("ProtectedFileButton", () => {
  it("downloads the file and opens it in a new tab through a temporary anchor", async () => {
    downloadMock.mockResolvedValue(new Blob(["pdf"]));
    const user = userEvent.setup();
    render(<ProtectedFileButton path={PATH} label={LABEL} />);

    await user.click(screen.getByRole("button", { name: LABEL }));

    await waitFor(() => expect(clickSpy.mock.calls).toHaveLength(1));
    expect(downloadMock).toHaveBeenCalledWith(PATH);
    const [anchor] = clickedAnchors;
    expect(anchor.href).toBe(OBJECT_URL);
    expect(anchor.target).toBe("_blank");
    expect(anchor.rel).toBe("noreferrer");
    expect(document.body.contains(anchor)).toBe(false);
    await waitFor(() => expect(isDisabled()).toBe(false));
  });

  it("revokes the object URL after the grace period", async () => {
    downloadMock.mockResolvedValue(new Blob(["pdf"]));
    const timeoutSpy = vi.spyOn(window, "setTimeout");
    const user = userEvent.setup();
    render(<ProtectedFileButton path={PATH} label={LABEL} />);

    await user.click(screen.getByRole("button", { name: LABEL }));
    await waitFor(() => expect(clickedAnchors).toHaveLength(1));

    const revokeCall = timeoutSpy.mock.calls.find(([, delay]) => delay === REVOKE_DELAY_MS);
    expect(revokeCall).toBeTruthy();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    (revokeCall?.[0] as () => void)();
    expect(revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL);
  });

  it("disables the button while the download is in progress", async () => {
    let finish: (blob: Blob) => void = () => undefined;
    downloadMock.mockReturnValue(new Promise<Blob>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    render(<ProtectedFileButton path={PATH} label={LABEL} />);

    await user.click(screen.getByRole("button", { name: LABEL }));
    expect(isDisabled()).toBe(true);

    finish(new Blob(["pdf"]));
    await waitFor(() => expect(isDisabled()).toBe(false));
  });

  it("reports the API error message through onError", async () => {
    downloadMock.mockRejectedValue(new ApiError(FORBIDDEN, "Acesso negado"));
    const onError = vi.fn();
    const user = userEvent.setup();
    render(<ProtectedFileButton path={PATH} label={LABEL} onError={onError} />);

    await user.click(screen.getByRole("button", { name: LABEL }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Acesso negado"));
    expect(clickedAnchors).toHaveLength(0);
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it("uses the fallback message for unknown errors", async () => {
    downloadMock.mockRejectedValue("boom");
    const onError = vi.fn();
    const user = userEvent.setup();
    render(<ProtectedFileButton path={PATH} label={LABEL} onError={onError} />);

    await user.click(screen.getByRole("button", { name: LABEL }));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(FALLBACK));
  });

  it("re-enables the button after a failure when no onError handler is provided", async () => {
    downloadMock.mockRejectedValue(new Error("falhou"));
    const user = userEvent.setup();
    render(<ProtectedFileButton path={PATH} label={LABEL} />);

    await user.click(screen.getByRole("button", { name: LABEL }));

    await waitFor(() => expect(downloadMock).toHaveBeenCalled());
    await waitFor(() => expect(isDisabled()).toBe(false));
    expect(clickedAnchors).toHaveLength(0);
  });
});
