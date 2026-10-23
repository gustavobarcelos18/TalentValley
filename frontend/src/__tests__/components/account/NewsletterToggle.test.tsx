import { screen, waitFor } from "@testing-library/react";
import { renderThemed as render } from "../recruiter/renderThemed";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { NewsletterToggle } from "@/components/account/NewsletterToggle";
import type { NewsletterResponse } from "@/types";

const SWITCH_LABEL = "Receber novidades por e-mail";
const NEVER: NewsletterResponse = { aceita: false, atualizadaEm: null };
const ON: NewsletterResponse = { aceita: true, atualizadaEm: "2026-10-19T15:30:00Z" };
const OFF: NewsletterResponse = { aceita: false, atualizadaEm: "2026-10-20T10:00:00Z" };

function getSwitch() {
  return screen.getByRole("switch", { name: SWITCH_LABEL }) as HTMLInputElement;
}

async function renderLoaded(initial: NewsletterResponse, save = vi.fn()) {
  const fetchNewsletter = vi.fn().mockResolvedValue(initial);
  render(<NewsletterToggle fetchNewsletter={fetchNewsletter} saveNewsletter={save} />);
  await waitFor(() => expect(getSwitch().disabled).toBe(false));
  return { fetchNewsletter, save };
}

describe("NewsletterToggle", () => {
  it("keeps the switch disabled and says it is loading until the saved choice arrives", async () => {
    let resolve: (value: NewsletterResponse) => void = () => undefined;
    const fetchNewsletter = vi.fn().mockReturnValue(new Promise<NewsletterResponse>((done) => (resolve = done)));
    render(<NewsletterToggle fetchNewsletter={fetchNewsletter} saveNewsletter={vi.fn()} />);

    expect(getSwitch().disabled).toBe(true);
    expect(screen.getByText("Carregando sua preferência...")).toBeTruthy();
    resolve(ON);
    await waitFor(() => expect(getSwitch().disabled).toBe(false));
  });

  it("shows off with no date for a person who never opted in", async () => {
    await renderLoaded(NEVER);

    expect(getSwitch().checked).toBe(false);
    expect(screen.getByText("Você ainda não aceitou receber novidades por e-mail.")).toBeTruthy();
  });

  it("shows on with the opt-in date", async () => {
    await renderLoaded(ON);

    expect(getSwitch().checked).toBe(true);
    expect(screen.getByText(/^Você aceitou receber novidades em /)).toBeTruthy();
  });

  it("shows off with the revocation date", async () => {
    await renderLoaded(OFF);

    expect(getSwitch().checked).toBe(false);
    expect(screen.getByText(/^Você deixou de receber novidades em /)).toBeTruthy();
  });

  it("withdraws the consent when turned off and shows the saved date", async () => {
    const save = vi.fn().mockResolvedValue(OFF);
    await renderLoaded(ON, save);

    await userEvent.click(getSwitch());

    expect(save).toHaveBeenCalledWith(false);
    expect(await screen.findByText(/^Você deixou de receber novidades em /)).toBeTruthy();
    expect(getSwitch().checked).toBe(false);
  });

  it("gives the consent when turned on", async () => {
    const save = vi.fn().mockResolvedValue(ON);
    await renderLoaded(OFF, save);

    await userEvent.click(getSwitch());

    expect(save).toHaveBeenCalledWith(true);
    expect(await screen.findByText(/^Você aceitou receber novidades em /)).toBeTruthy();
    expect(getSwitch().checked).toBe(true);
  });

  it("blocks the switch while saving", async () => {
    let resolve: (value: NewsletterResponse) => void = () => undefined;
    const save = vi.fn().mockReturnValue(new Promise<NewsletterResponse>((done) => (resolve = done)));
    await renderLoaded(ON, save);

    await userEvent.click(getSwitch());

    expect(getSwitch().disabled).toBe(true);
    resolve(OFF);
    await waitFor(() => expect(getSwitch().disabled).toBe(false));
  });

  it("keeps the previous choice and shows the server message when saving fails", async () => {
    const save = vi.fn().mockRejectedValue(new ApiError(403, "Account access is unavailable."));
    await renderLoaded(ON, save);

    await userEvent.click(getSwitch());

    expect((await screen.findByRole("alert")).textContent).toBe("Account access is unavailable.");
    expect(getSwitch().checked).toBe(true);
    expect(getSwitch().disabled).toBe(false);
  });

  it("shows the fallback message when saving fails without details, and clears it on the next try", async () => {
    const save = vi.fn().mockRejectedValueOnce("falha desconhecida").mockResolvedValueOnce(OFF);
    await renderLoaded(ON, save);

    await userEvent.click(getSwitch());
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Não foi possível salvar sua preferência. Tente novamente."
    );
    await userEvent.click(getSwitch());

    expect(await screen.findByText(/^Você deixou de receber novidades em /)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an error and keeps the switch disabled when the saved choice cannot be loaded", async () => {
    const fetchNewsletter = vi.fn().mockRejectedValue("falha desconhecida");
    render(<NewsletterToggle fetchNewsletter={fetchNewsletter} saveNewsletter={vi.fn()} />);

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Não foi possível carregar sua preferência de e-mails."
    );
    expect(getSwitch().disabled).toBe(true);
  });

  it("stops saying it is loading once the load has failed", async () => {
    const fetchNewsletter = vi.fn().mockRejectedValue("falha desconhecida");
    render(<NewsletterToggle fetchNewsletter={fetchNewsletter} saveNewsletter={vi.fn()} />);

    await screen.findByRole("alert");

    expect(screen.queryByText("Carregando sua preferência...")).toBeNull();
  });

  it("announces the description politely so screen readers hear the new state", async () => {
    await renderLoaded(ON);

    expect(screen.getByText(/^Você aceitou receber novidades em /).getAttribute("aria-live")).toBe("polite");
  });
});
