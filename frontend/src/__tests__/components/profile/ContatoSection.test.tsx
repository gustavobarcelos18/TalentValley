import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContatoSection } from "@/components/profile/ContatoSection";
import { updateContato } from "@/lib/student";
import type { ContatoResponse } from "@/types/student";
import { makeProfile, makeSectionProps } from "./profileFixtures";

vi.mock("@/lib/student", () => ({ updateContato: vi.fn() }));

vi.setConfig({ testTimeout: 15_000 });

const mockUpdate = vi.mocked(updateContato);

const EDIT_LABEL = "Editar contato";
const PHONE_LABEL = "Telefone";
const EMAIL_LABEL = "E-mail profissional";
const LINKEDIN_LABEL = "LinkedIn";
const GITHUB_LABEL = "GitHub";
const PORTFOLIO_LABEL = "Portfólio";
const SAVE_LABEL = "Salvar";
const EMPTY_MESSAGE = "Informe como recrutadores podem falar com você.";
const PHONE_ERROR = "Informe um telefone brasileiro válido.";
const PHONE_HINT = "Opcional. Informe um telefone brasileiro.";
const EMAIL_HELPER_ERROR = "Informe um e-mail válido.";
const URL_HELPER_ERROR = "Informe uma URL completa iniciada por http:// ou https://.";
const GENERIC_SAVE_ERROR = "Não foi possível salvar o contato. Tente novamente.";
const BAD_URL = "ftp://example.com";
const LINKEDIN_URL = "https://linkedin.com/in/maria";
const ALL_LABELS = [PHONE_LABEL, EMAIL_LABEL, LINKEDIN_LABEL, GITHUB_LABEL, PORTFOLIO_LABEL];

const EMPTY_CONTATO: ContatoResponse = {
  telefone: null,
  emailProfissional: null,
  linkedInUrl: null,
  gitHubUrl: null,
  portfolioUrl: null,
};

function renderSection(contato: Partial<ContatoResponse> = {}) {
  const props = makeSectionProps({ contato: { ...makeProfile().contato, ...contato } });
  render(<ContatoSection {...props} />);
  return props;
}

function renderEmpty() {
  const props = makeSectionProps({ contato: EMPTY_CONTATO });
  render(<ContatoSection {...props} />);
  return props;
}

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: EDIT_LABEL }));
  return screen.findByRole("dialog");
}

function input(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function setValue(label: string, value: string) {
  fireEvent.change(input(label), { target: { value } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: SAVE_LABEL }));
}

function linkNamed(name: string): HTMLAnchorElement {
  return screen.getByRole("link", { name }) as HTMLAnchorElement;
}

describe("ContatoSection display", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });

  it("renders every contact as an actionable link with the right target", () => {
    renderSection({ telefone: "5532999998888" });

    const phone = linkNamed("Ligar para (32) 99999-8888");
    expect(phone.getAttribute("href")).toBe("tel:+5532999998888");
    expect(phone.target).toBe("");

    const email = linkNamed("Enviar e-mail para maria@example.com");
    expect(email.getAttribute("href")).toBe("mailto:maria@example.com");

    const linkedin = linkNamed("Abrir LinkedIn em nova aba");
    expect(linkedin.getAttribute("href")).toBe(LINKEDIN_URL);
    expect(linkedin.target).toBe("_blank");
    expect(linkedin.rel).toBe("noopener noreferrer");

    expect(linkNamed("Abrir GitHub em nova aba").getAttribute("href")).toBe("https://github.com/maria");
    expect(linkNamed("Abrir Portfólio em nova aba").getAttribute("href")).toBe("https://maria.dev");
  });

  it("shows the row labels for the contacts that have a value", () => {
    renderSection();

    for (const label of ALL_LABELS) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it("omits the rows of contacts that are null", () => {
    renderSection({ telefone: null, gitHubUrl: null, portfolioUrl: null });

    expect(screen.queryByText(PHONE_LABEL)).toBeNull();
    expect(screen.queryByText(GITHUB_LABEL)).toBeNull();
    expect(screen.queryByText(PORTFOLIO_LABEL)).toBeNull();
    expect(screen.getByText(EMAIL_LABEL)).toBeTruthy();
    expect(screen.getByText(LINKEDIN_LABEL)).toBeTruthy();
  });

  it.each([
    ["too short", "123"],
    ["all repeated digits", "11111111111"],
    ["starting with 00", "0012345678"],
  ])("shows a malformed phone (%s) as plain text instead of a link", (_case, telefone) => {
    renderSection({ telefone });

    expect(screen.getByText(telefone)).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Ligar para/ })).toBeNull();
  });

  it("shows a malformed e-mail as plain text instead of a mailto link", () => {
    renderSection({ emailProfissional: "not-an-email" });

    expect(screen.getByText("not-an-email")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Enviar e-mail/ })).toBeNull();
  });

  it("shows URLs with an unsafe protocol as plain text instead of links", () => {
    renderSection({ linkedInUrl: "javascript:alert(1)", gitHubUrl: BAD_URL, portfolioUrl: "not a url" });

    expect(screen.getByText("javascript:alert(1)")).toBeTruthy();
    expect(screen.getByText(BAD_URL)).toBeTruthy();
    expect(screen.getByText("not a url")).toBeTruthy();
    expect(screen.queryAllByRole("link", { name: /nova aba/ })).toHaveLength(0);
  });

  it("does not render a call link for a whitespace-only phone", () => {
    renderSection({ telefone: "   " });

    expect(screen.queryByRole("link", { name: /^Ligar para/ })).toBeNull();
  });

  it("shows the empty state when every contact is only whitespace", () => {
    renderSection({ telefone: "   ", emailProfissional: " ", linkedInUrl: "  ", gitHubUrl: "	", portfolioUrl: "   " });

    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
    for (const label of ALL_LABELS) {
      expect(screen.queryByText(label)).toBeNull();
    }
  });

  it("omits the row of a whitespace-only contact while keeping the filled ones", () => {
    renderSection({ telefone: "   ", portfolioUrl: "  " });

    expect(screen.queryByText(PHONE_LABEL)).toBeNull();
    expect(screen.queryByText(PORTFOLIO_LABEL)).toBeNull();
    expect(screen.getByText(EMAIL_LABEL)).toBeTruthy();
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it("shows the empty state and opens the form from its action when nothing is filled", async () => {
    const user = userEvent.setup();
    renderEmpty();

    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Adicionar contato" }));

    expect(await screen.findByRole("dialog", { name: "Editar contato" })).toBeTruthy();
  });
});

describe("ContatoSection form", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(undefined);
  });

  it("opens the dialog prefilled with the stored values and a formatted phone", async () => {
    const user = userEvent.setup();
    renderSection({ telefone: "32999998888" });

    await openForm(user);

    expect(input(PHONE_LABEL).value).toBe("(32) 99999-8888");
    expect(input(EMAIL_LABEL).value).toBe("maria@example.com");
    expect(input(LINKEDIN_LABEL).value).toBe(LINKEDIN_URL);
    expect(input(GITHUB_LABEL).value).toBe("https://github.com/maria");
    expect(input(PORTFOLIO_LABEL).value).toBe("https://maria.dev");
  });

  it("opens with empty fields when the profile has no contact", async () => {
    const user = userEvent.setup();
    renderEmpty();

    await openForm(user);

    for (const label of ALL_LABELS) {
      expect(input(label).value).toBe("");
    }
  });

  it("closes without saving when the user cancels", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    await openForm(user);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it("saves the normalized payload, closes the dialog and notifies", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    await openForm(user);

    setValue(PHONE_LABEL, "(32) 98888-7777");
    setValue(EMAIL_LABEL, "Maria.Silva@Example.COM");
    setValue(LINKEDIN_LABEL, "https://linkedin.com/in/nova");
    setValue(GITHUB_LABEL, "https://github.com/nova");
    setValue(PORTFOLIO_LABEL, "https://nova.dev");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith({
      telefone: "32988887777",
      emailProfissional: "maria.silva@example.com",
      linkedInUrl: "https://linkedin.com/in/nova",
      gitHubUrl: "https://github.com/nova",
      portfolioUrl: "https://nova.dev",
    });
    expect(props.notify).toHaveBeenCalledWith("Contato atualizado.");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("sends null for every cleared field", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    await openForm(user);

    for (const label of ALL_LABELS) setValue(label, "");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(EMPTY_CONTATO);
  });

  it("sends a null phone when the phone field only has spaces", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    await openForm(user);

    setValue(PHONE_LABEL, "   ");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ telefone: null }));
  });

  it("truncates e-mail and URL inputs at their maximum lengths", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    setValue(EMAIL_LABEL, "a".repeat(300));
    setValue(LINKEDIN_LABEL, `https://x.com/${"a".repeat(3000)}`);
    setValue(GITHUB_LABEL, `https://x.com/${"b".repeat(3000)}`);
    setValue(PORTFOLIO_LABEL, `https://x.com/${"c".repeat(3000)}`);

    expect(input(EMAIL_LABEL).value).toHaveLength(254);
    expect(input(LINKEDIN_LABEL).value).toHaveLength(2048);
    expect(input(GITHUB_LABEL).value).toHaveLength(2048);
    expect(input(PORTFOLIO_LABEL).value).toHaveLength(2048);
  });

  it.each([
    ["letters", "abc"],
    ["too few digits", "1234"],
    ["repeated digits", "(11) 11111-1111"],
    ["a 00 area code", "(00) 91234-5678"],
  ])("rejects an invalid phone (%s) on submit, flags the field and does not call the API", async (_case, telefone) => {
    const user = userEvent.setup();
    const props = renderSection();
    await openForm(user);

    setValue(PHONE_LABEL, telefone);

    expect(screen.queryByText(PHONE_ERROR)).toBeNull();
    expect(input(PHONE_LABEL).getAttribute("aria-invalid")).toBe("false");
    submit();

    expect(await screen.findByText(PHONE_ERROR)).toBeTruthy();
    expect(input(PHONE_LABEL).getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it("rejects an invalid e-mail with the live field error and no alert, without calling the API", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    setValue(EMAIL_LABEL, "maria@semponto");

    expect(screen.getByText(EMAIL_HELPER_ERROR)).toBeTruthy();
    expect(input(EMAIL_LABEL).getAttribute("aria-invalid")).toBe("true");
    submit();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(EMAIL_HELPER_ERROR)).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("drops an earlier API error when the next attempt is stopped by a field error", async () => {
    const user = userEvent.setup();
    renderSection();
    mockUpdate.mockRejectedValue(new Error("Telefone já cadastrado."));
    await openForm(user);
    submit();
    await screen.findByRole("alert");

    setValue(EMAIL_LABEL, "maria@semponto");
    submit();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(EMAIL_HELPER_ERROR)).toBeTruthy();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it("shows the neutral e-mail hint while the field is valid", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    expect(screen.getByText("Diferente do e-mail de login. Opcional.")).toBeTruthy();
    expect(input(EMAIL_LABEL).getAttribute("aria-invalid")).toBe("false");
  });

  it.each([
    [LINKEDIN_LABEL],
    [GITHUB_LABEL],
    [PORTFOLIO_LABEL],
  ])("rejects an invalid %s URL with the live field error and no alert, without calling the API", async (label) => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    setValue(label, BAD_URL);

    expect(screen.getByText(URL_HELPER_ERROR)).toBeTruthy();
    expect(input(label).getAttribute("aria-invalid")).toBe("true");
    submit();

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(URL_HELPER_ERROR)).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("shows the neutral phone hint until the first submit attempt", async () => {
    const user = userEvent.setup();
    renderSection();
    await openForm(user);

    expect(screen.getByText(PHONE_HINT)).toBeTruthy();
    setValue(PHONE_LABEL, "abc");
    expect(screen.getByText(PHONE_HINT)).toBeTruthy();
  });

  it("drops the phone error once the phone becomes valid and then saves", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    await openForm(user);
    setValue(PHONE_LABEL, "abc");
    submit();
    await screen.findByText(PHONE_ERROR);

    setValue(PHONE_LABEL, "32988887777");

    expect(screen.queryByText(PHONE_ERROR)).toBeNull();
    expect(screen.getByText(PHONE_HINT)).toBeTruthy();
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the API error message and keeps the dialog open when saving fails", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    mockUpdate.mockRejectedValue(new Error("Telefone já cadastrado."));
    await openForm(user);

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe("Telefone já cadastrado.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the failure carries no message", async () => {
    const user = userEvent.setup();
    renderSection();
    mockUpdate.mockRejectedValue("boom");
    await openForm(user);

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_SAVE_ERROR);
  });

  it("disables the form and shows progress while saving, then ignores duplicate submits", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    let resolveSave: () => void = () => undefined;
    mockUpdate.mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve; }));
    await openForm(user);

    submit();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Salvando..." }).hasAttribute("disabled")).toBe(true);
    expect(within(dialog).getByRole("button", { name: "Cancelar" }).hasAttribute("disabled")).toBe(true);
    expect(input(PHONE_LABEL).disabled).toBe(true);
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    resolveSave();
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
  });
});
