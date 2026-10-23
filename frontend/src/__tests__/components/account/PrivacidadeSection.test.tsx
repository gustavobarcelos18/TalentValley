import { screen, waitFor } from "@testing-library/react";
import { renderThemed as render } from "../recruiter/renderThemed";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { PrivacidadeSection } from "@/components/account/PrivacidadeSection";

const DOWNLOAD_BUTTON = "Baixar meus dados";
const FALLBACK_ERROR = "Não foi possível baixar seus dados. Tente novamente.";
const DATA = { conta: { email: "pessoa@example.test" }, slug: "abc" };
const NEWSLETTER = { aceita: false, atualizadaEm: null };

function renderSection(fetchData: () => Promise<unknown> = vi.fn()) {
  return render(
    <PrivacidadeSection
      fetchData={fetchData}
      fetchNewsletter={vi.fn().mockResolvedValue(NEWSLETTER)}
      saveNewsletter={vi.fn().mockResolvedValue(NEWSLETTER)}
    />
  );
}

const createObjectURL = vi.fn<(blob: Blob) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();
let clicked: { download: string; href: string }[] = [];

beforeEach(() => {
  clicked = [];
  createObjectURL.mockReturnValue("blob:talent-valley");
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ download: this.download, href: this.href });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  createObjectURL.mockReset();
  revokeObjectURL.mockReset();
});

describe("PrivacidadeSection", () => {
  it("explains what is downloaded and offers the download button", () => {
    renderSection();

    expect(screen.getByRole("heading", { name: "Privacidade" })).toBeTruthy();
    expect(screen.getByText(/ele informa apenas se você os enviou/)).toBeTruthy();
    expect(screen.getByRole("button", { name: DOWNLOAD_BUTTON })).toBeTruthy();
  });

  it("offers the newsletter switch in the same section", async () => {
    renderSection();

    const toggle = screen.getByRole("switch", { name: "Receber novidades por e-mail" }) as HTMLInputElement;
    await waitFor(() => expect(toggle.disabled).toBe(false));
  });

  it("downloads the loaded data as a dated JSON file and releases the temporary link", async () => {
    const fetchData = vi.fn().mockResolvedValue(DATA);
    renderSection(fetchData);

    await userEvent.click(screen.getByRole("button", { name: DOWNLOAD_BUTTON }));

    expect(await screen.findByText("Seus dados foram baixados.")).toBeTruthy();
    expect(fetchData).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await blob.text())).toEqual(DATA);
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toMatch(/^talent-valley-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
    expect(clicked[0].href).toBe("blob:talent-valley");
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:talent-valley"));
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("disables the button while the data is loading", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    const fetchData = vi.fn().mockReturnValue(new Promise((done) => (resolve = done)));
    renderSection(fetchData);

    await userEvent.click(screen.getByRole("button", { name: DOWNLOAD_BUTTON }));

    const busy = screen.getByRole("button", { name: "Preparando..." }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);
    resolve(DATA);
    await waitFor(() => expect(screen.getByRole("button", { name: DOWNLOAD_BUTTON })).toBeTruthy());
  });

  it("shows the fallback message and downloads nothing when the request fails", async () => {
    const fetchData = vi.fn().mockRejectedValue("falha desconhecida");
    renderSection(fetchData);

    await userEvent.click(screen.getByRole("button", { name: DOWNLOAD_BUTTON }));

    expect((await screen.findByRole("alert")).textContent).toBe(FALLBACK_ERROR);
    expect(clicked).toHaveLength(0);
    expect(screen.queryByText("Seus dados foram baixados.")).toBeNull();
  });

  it("shows the server message when the API explains the failure", async () => {
    const fetchData = vi.fn().mockRejectedValue(new ApiError(403, "Account access is unavailable."));
    renderSection(fetchData);

    await userEvent.click(screen.getByRole("button", { name: DOWNLOAD_BUTTON }));

    expect((await screen.findByRole("alert")).textContent).toBe("Account access is unavailable.");
    expect(clicked).toHaveLength(0);
  });

  it("clears the previous error when the download is tried again", async () => {
    const fetchData = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValueOnce(DATA);
    renderSection(fetchData);

    await userEvent.click(screen.getByRole("button", { name: DOWNLOAD_BUTTON }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: DOWNLOAD_BUTTON }));

    expect(await screen.findByText("Seus dados foram baixados.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
