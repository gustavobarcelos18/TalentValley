import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RecruiterDashboardView } from "@/components/recruiter/RecruiterDashboardView";
import { ApiError } from "@/lib/api";
import type { RecruiterDashboard } from "@/types/recruiter";
import { makeDashboard } from "./recruiterDiscoveryFixtures";
import { makeTalentListItem } from "./recruiterFixtures";

vi.setConfig({ testTimeout: 15_000 });

const mocks = vi.hoisted(() => ({
  fetchRecruiterDashboard: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/recruiter", () => ({ fetchRecruiterDashboard: mocks.fetchRecruiterDashboard }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

const TALENTS_PATH = "/recrutador/talentos";
const LOAD_FALLBACK = "Não foi possível carregar a visão geral.";
const NO_FAVORITES = "Você ainda não possui favoritos recentes.";
const NO_LOCATION = "Localização não informada";
const VERIFIED_CHIP = "RPV verificado";
const RETURNING_SUBTITLE = "Acompanhe o que mudou desde o seu último acesso.";
const WELCOME_SUBTITLE = "Bem-vindo. Comece explorando os talentos disponíveis.";

function searchInput() {
  return screen.getByLabelText("Buscar talentos") as HTMLInputElement;
}

function searchButton() {
  return screen.getByRole("button", { name: "Buscar" });
}

function indicatorValue(label: string) {
  return screen.getByText(label).previousElementSibling?.textContent;
}

async function renderLoaded(dashboard: RecruiterDashboard = makeDashboard()) {
  mocks.fetchRecruiterDashboard.mockResolvedValue(dashboard);
  render(<RecruiterDashboardView />);
  await screen.findByText(dashboard.favoritosRecentes.length ? dashboard.favoritosRecentes[0].talento.nomeCompleto : NO_FAVORITES);
}

describe("RecruiterDashboardView", () => {
  beforeEach(() => {
    mocks.fetchRecruiterDashboard.mockResolvedValue(makeDashboard());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("loading", () => {
    it("shows the page structure with welcome copy and no figures while the dashboard loads", () => {
      mocks.fetchRecruiterDashboard.mockReturnValue(new Promise(() => undefined));
      render(<RecruiterDashboardView />);
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Visão geral");
      expect(screen.getByText(WELCOME_SUBTITLE)).toBeTruthy();
      expect(indicatorValue("Perfis atualizados")).toBe("");
      expect(indicatorValue("Novos alunos")).toBe("");
      expect(indicatorValue("Favoritos")).toBe("");
      expect(screen.queryByText(NO_FAVORITES)).toBeNull();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("requests the dashboard once on mount", async () => {
      await renderLoaded();
      expect(mocks.fetchRecruiterDashboard).toHaveBeenCalledTimes(1);
    });
  });

  describe("with data", () => {
    it("shows the three indicators with the values from the API", async () => {
      await renderLoaded();
      expect(indicatorValue("Perfis atualizados")).toBe("4");
      expect(indicatorValue("Novos alunos")).toBe("7");
      expect(indicatorValue("Favoritos")).toBe("2");
    });

    it("greets a returning recruiter with what changed since the last visit", async () => {
      await renderLoaded();
      expect(screen.getByText(RETURNING_SUBTITLE)).toBeTruthy();
      expect(screen.queryByText(WELCOME_SUBTITLE)).toBeNull();
    });

    it("welcomes a first-time recruiter (no last access)", async () => {
      await renderLoaded(makeDashboard({ desdeUltimoAcesso: null }));
      expect(screen.getByText(WELCOME_SUBTITLE)).toBeTruthy();
      expect(screen.queryByText(RETURNING_SUBTITLE)).toBeNull();
    });

    it("links to the talent search and to the favorites page", async () => {
      await renderLoaded();
      expect(screen.getByRole("link", { name: "Explorar talentos" }).getAttribute("href")).toBe(TALENTS_PATH);
      expect(screen.getByRole("link", { name: "Ver todos" }).getAttribute("href")).toBe("/recrutador/favoritos");
    });

    it("lists each recent favorite as a link to the talent profile with its location", async () => {
      await renderLoaded(makeDashboard({
        favoritosRecentes: [
          { favoritadoEm: "2026-09-02T12:00:00Z", talento: makeTalentListItem() },
          { favoritadoEm: "2026-09-03T12:00:00Z", talento: makeTalentListItem({ id: "t2", slug: "joao-lima", nomeCompleto: "João Lima", cidade: "Ubá", uf: "MG" }) },
        ],
      }));
      const maria = screen.getByRole("link", { name: /Maria Souza/ });
      expect(maria.getAttribute("href")).toBe("/recrutador/talentos/maria-souza");
      expect(within(maria).getByText("Rio Pomba / MG")).toBeTruthy();
      const joao = screen.getByRole("link", { name: /João Lima/ });
      expect(joao.getAttribute("href")).toBe("/recrutador/talentos/joao-lima");
      expect(within(joao).getByText("Ubá / MG")).toBeTruthy();
      expect(screen.queryByText(NO_FAVORITES)).toBeNull();
    });

    it.each([
      ["only the city", { cidade: "Ubá", uf: null }, "Ubá"],
      ["only the state", { cidade: null, uf: "MG" }, "MG"],
      ["neither city nor state", { cidade: null, uf: null }, NO_LOCATION],
    ])("shows the location with %s", async (_label, location, expected) => {
      await renderLoaded(makeDashboard({
        favoritosRecentes: [{ favoritadoEm: "2026-09-02T12:00:00Z", talento: makeTalentListItem(location) }],
      }));
      expect(within(screen.getByRole("link", { name: /Maria Souza/ })).getByText(expected)).toBeTruthy();
    });

    it("marks only the favorites with an RPV-verified main formation", async () => {
      const verified = makeTalentListItem({
        formacaoPrincipal: { tipo: "TECNICO", nome: "Informática", instituicao: "IF Sudeste MG", rpvVerificado: true },
      });
      const unverified = makeTalentListItem({ id: "t2", slug: "joao-lima", nomeCompleto: "João Lima" });
      const withoutFormation = makeTalentListItem({ id: "t3", slug: "ana-reis", nomeCompleto: "Ana Reis", formacaoPrincipal: null });
      await renderLoaded(makeDashboard({
        favoritosRecentes: [verified, unverified, withoutFormation].map((talento) => ({ favoritadoEm: "2026-09-02T12:00:00Z", talento })),
      }));
      expect(within(screen.getByRole("link", { name: /Maria Souza/ })).getByText(VERIFIED_CHIP)).toBeTruthy();
      expect(within(screen.getByRole("link", { name: /João Lima/ })).queryByText(VERIFIED_CHIP)).toBeNull();
      expect(within(screen.getByRole("link", { name: /Ana Reis/ })).queryByText(VERIFIED_CHIP)).toBeNull();
    });

    it("tells the recruiter when there are no recent favorites", async () => {
      await renderLoaded(makeDashboard({ favoritosRecentes: [] }));
      expect(screen.getByText(NO_FAVORITES)).toBeTruthy();
    });
  });

  describe("failure", () => {
    it("shows the API message and a retry button when the request fails", async () => {
      mocks.fetchRecruiterDashboard.mockRejectedValue(new ApiError(500, "Servidor indisponível"));
      render(<RecruiterDashboardView />);
      expect((await screen.findByRole("alert")).textContent).toContain("Servidor indisponível");
      expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeTruthy();
    });

    it("falls back to the generic message when the rejection carries no text", async () => {
      mocks.fetchRecruiterDashboard.mockRejectedValue("falhou");
      render(<RecruiterDashboardView />);
      expect((await screen.findByRole("alert")).textContent).toContain(LOAD_FALLBACK);
    });

    it("reloads the dashboard when the user retries and removes the error", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.fetchRecruiterDashboard.mockRejectedValueOnce(new ApiError(500, "Servidor indisponível"));
      render(<RecruiterDashboardView />);
      await screen.findByRole("alert");

      await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
      expect(await screen.findByText("Maria Souza")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(mocks.fetchRecruiterDashboard).toHaveBeenCalledTimes(2);
      expect(indicatorValue("Perfis atualizados")).toBe("4");
    });

    it("shows the loading state again while a retry is in flight", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.fetchRecruiterDashboard.mockRejectedValueOnce(new ApiError(500, "Servidor indisponível"));
      render(<RecruiterDashboardView />);
      await screen.findByRole("alert");
      mocks.fetchRecruiterDashboard.mockReturnValue(new Promise(() => undefined));

      await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByText(NO_FAVORITES)).toBeNull();
      expect(indicatorValue("Perfis atualizados")).toBe("");
    });
  });

  describe("search", () => {
    it("goes to the unfiltered talent list when the term is empty", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.click(searchButton());
      expect(mocks.push).toHaveBeenCalledWith(TALENTS_PATH);
    });

    it("treats a term with only spaces as empty", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.type(searchInput(), "   ");
      await user.click(searchButton());
      expect(mocks.push).toHaveBeenCalledWith(TALENTS_PATH);
    });

    it("sends the trimmed and URL-encoded name to the talent list", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.type(searchInput(), "  José & Ana  ");
      await user.click(searchButton());
      expect(mocks.push).toHaveBeenCalledTimes(1);
      expect(mocks.push).toHaveBeenCalledWith(`${TALENTS_PATH}?nome=Jos%C3%A9%20%26%20Ana`);
    });

    it("searches when the user presses Enter", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.type(searchInput(), "Maria{Enter}");
      expect(mocks.push).toHaveBeenCalledWith(`${TALENTS_PATH}?nome=Maria`);
    });

    it("blocks a term with emoji, explains it and does not navigate", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      fireEvent.change(searchInput(), { target: { value: "Maria 😀" } });
      await user.click(searchButton());
      expect(screen.getByText("Informe uma busca válida.")).toBeTruthy();
      expect(searchInput().getAttribute("aria-invalid")).toBe("true");
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it("removes the validation error as soon as the user edits the term", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      fireEvent.change(searchInput(), { target: { value: "😀" } });
      await user.click(searchButton());
      expect(screen.getByText("Informe uma busca válida.")).toBeTruthy();

      await user.clear(searchInput());
      await waitFor(() => expect(screen.queryByText("Informe uma busca válida.")).toBeNull());
      expect(searchInput().getAttribute("aria-invalid")).toBe("false");
    });

    it("keeps at most 150 characters of the term", async () => {
      await renderLoaded();
      expect(searchInput().getAttribute("maxlength")).toBe("150");
      fireEvent.change(searchInput(), { target: { value: "a".repeat(170) } });
      expect(searchInput().value).toBe("a".repeat(150));
    });
  });
});
