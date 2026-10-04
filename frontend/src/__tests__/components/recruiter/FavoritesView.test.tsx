import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesView } from "@/components/recruiter/FavoritesView";
import { ApiError } from "@/lib/api";
import { addFavorite, fetchFavorites, fetchTalent, removeFavorite } from "@/lib/recruiter";
import type { FavoriteTalent, PaginatedResponse, TalentListItem } from "@/types/recruiter";
import { makeTalentListItem, makeTalentProfile } from "./recruiterFixtures";

vi.setConfig({ testTimeout: 15_000 });

const nav = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn() },
  pathname: "/recrutador/favoritos",
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => nav.router,
  usePathname: () => nav.pathname,
  useSearchParams: () => nav.params,
}));
vi.mock("@/hooks/useProtectedFile", () => ({
  useProtectedFile: () => ({ url: null, loading: false, error: null, reload: vi.fn() }),
}));
vi.mock("@/lib/recruiter", () => ({
  fetchFavorites: vi.fn(),
  fetchTalent: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

const fetchFavoritesMock = vi.mocked(fetchFavorites);
const fetchTalentMock = vi.mocked(fetchTalent);
const addMock = vi.mocked(addFavorite);
const removeMock = vi.mocked(removeFavorite);

const NOT_FOUND = 404;
const SERVER_ERROR = 500;
const UNAVAILABLE = "Este perfil não está mais disponível.";
const LIMIT_MESSAGE = "A comparação permite selecionar apenas dois talentos.";
const LOAD_FALLBACK = "Não foi possível carregar seus favoritos.";
const FAVORITES_PATH = "/recrutador/favoritos";
const PAGE_SIZE = 10;

const ANA = makeTalentListItem({ id: "t-ana", slug: "ana-lima", nomeCompleto: "Ana Lima", favorito: true });
const BRUNO = makeTalentListItem({ id: "t-bruno", slug: "bruno-reis", nomeCompleto: "Bruno Reis", favorito: true });
const CARLA = makeTalentListItem({ id: "t-carla", slug: "carla-dias", nomeCompleto: "Carla Dias", favorito: true });

function favorites(items: TalentListItem[], page = 1, totalPages = 1): PaginatedResponse<FavoriteTalent> {
  return {
    items: items.map((talento) => ({ favoritadoEm: "2026-09-01T12:00:00Z", talento })),
    page,
    pageSize: PAGE_SIZE,
    totalItems: items.length,
    totalPages,
  };
}

function setPage(value: string | null) {
  nav.params = new URLSearchParams(value === null ? "" : `page=${value}`);
}

function removeLabel(talent: TalentListItem) {
  return `Remover dos favoritos: ${talent.nomeCompleto}`;
}

function compareCheckboxes() {
  return screen.getAllByRole("checkbox", { name: "Comparar" }) as HTMLInputElement[];
}

beforeEach(() => {
  setPage(null);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe("FavoritesView", () => {
  it("shows skeletons while the favorites are loading", () => {
    fetchFavoritesMock.mockReturnValue(new Promise(() => undefined));
    const { container } = render(<FavoritesView />);

    expect(screen.getByRole("heading", { level: 1, name: "Favoritos" })).toBeTruthy();
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(3);
    expect(screen.queryByRole("article")).toBeNull();
  });

  it("lists the favorited talents", async () => {
    fetchFavoritesMock.mockResolvedValue(favorites([ANA, BRUNO]));
    render(<FavoritesView />);

    expect(await screen.findByRole("heading", { name: "Ana Lima" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Bruno Reis" })).toBeTruthy();
    expect(fetchFavoritesMock).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("navigation", { name: "Paginação de favoritos" })).toBeNull();
    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  it("shows the empty state with a link to explore talents", async () => {
    fetchFavoritesMock.mockResolvedValue(favorites([]));
    render(<FavoritesView />);

    expect(await screen.findByText("Nenhum favorito ainda")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Explorar talentos" }).getAttribute("href")).toBe("/recrutador/talentos");
  });

  it("shows the error with the API message and retries", async () => {
    fetchFavoritesMock.mockRejectedValueOnce(new ApiError(SERVER_ERROR, "Falha no servidor")).mockResolvedValueOnce(favorites([ANA]));
    const user = userEvent.setup();
    render(<FavoritesView />);

    expect((await screen.findByRole("alert")).textContent).toContain("Falha no servidor");
    expect(screen.queryByText("Nenhum favorito ainda")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("heading", { name: "Ana Lima" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fetchFavoritesMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback message for unknown loading failures", async () => {
    fetchFavoritesMock.mockRejectedValue("boom");
    render(<FavoritesView />);

    expect((await screen.findByRole("alert")).textContent).toContain(LOAD_FALLBACK);
  });

  it("requests the page given in the query string", async () => {
    setPage("2");
    fetchFavoritesMock.mockResolvedValue(favorites([ANA], 2, 3));
    render(<FavoritesView />);

    await screen.findByRole("heading", { name: "Ana Lima" });
    expect(fetchFavoritesMock).toHaveBeenCalledWith(2);
    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  it.each(["abc", "0", "-3", "1.5"])("normalizes the invalid page %s to the first page", async (value) => {
    setPage(value);
    fetchFavoritesMock.mockResolvedValue(favorites([ANA]));
    render(<FavoritesView />);

    await screen.findByRole("heading", { name: "Ana Lima" });
    expect(fetchFavoritesMock).toHaveBeenCalledWith(1);
    expect(nav.router.replace).toHaveBeenCalledWith(FAVORITES_PATH);
  });

  it("does not rewrite the URL when the page is explicitly 1", async () => {
    setPage("1");
    fetchFavoritesMock.mockResolvedValue(favorites([ANA]));
    render(<FavoritesView />);

    await screen.findByRole("heading", { name: "Ana Lima" });
    expect(nav.router.replace).not.toHaveBeenCalled();
  });

  it.each([
    { label: /próxima|next/i, expectedPath: `${FAVORITES_PATH}?page=3` },
    { label: /anterior|previous/i, expectedPath: FAVORITES_PATH },
  ])("navigates with the pagination control to $expectedPath", async ({ label, expectedPath }) => {
    setPage("2");
    fetchFavoritesMock.mockResolvedValue(favorites([ANA], 2, 3));
    const user = userEvent.setup();
    render(<FavoritesView />);

    const pagination = await screen.findByRole("navigation", { name: "Paginação de favoritos" });
    await user.click(within(pagination).getByRole("button", { name: label }));

    expect(nav.router.push).toHaveBeenCalledWith(expectedPath);
    expect(screen.queryByRole("article")).toBeNull();
  });

  describe("selection for comparison", () => {
    it("lets the user select two talents and blocks a third", async () => {
      fetchFavoritesMock.mockResolvedValue(favorites([ANA, BRUNO, CARLA]));
      const user = userEvent.setup();
      render(<FavoritesView />);
      await screen.findByRole("heading", { name: "Ana Lima" });

      await user.click(compareCheckboxes()[0]);
      expect(screen.getByText("1 talento selecionado. Selecione mais 1 para comparar.")).toBeTruthy();
      await user.click(compareCheckboxes()[1]);
      expect(screen.getByText("2 talentos selecionados para comparação.")).toBeTruthy();
      await user.click(compareCheckboxes()[2]);

      expect(screen.getByText(LIMIT_MESSAGE)).toBeTruthy();
      expect(compareCheckboxes().map((checkbox) => checkbox.checked)).toEqual([true, true, false]);
    });

    it("clears the limit message and frees a slot when a talent is unselected", async () => {
      fetchFavoritesMock.mockResolvedValue(favorites([ANA, BRUNO, CARLA]));
      const user = userEvent.setup();
      render(<FavoritesView />);
      await screen.findByRole("heading", { name: "Ana Lima" });
      await user.click(compareCheckboxes()[0]);
      await user.click(compareCheckboxes()[1]);
      await user.click(compareCheckboxes()[2]);

      await user.click(compareCheckboxes()[0]);

      expect(screen.queryByText(LIMIT_MESSAGE)).toBeNull();
      expect(compareCheckboxes().map((checkbox) => checkbox.checked)).toEqual([false, true, false]);
      await user.click(compareCheckboxes()[2]);
      expect(compareCheckboxes().map((checkbox) => checkbox.checked)).toEqual([false, true, true]);
    });
  });

  describe("changing favorites", () => {
    it("refreshes the list after removing a favorite", async () => {
      fetchFavoritesMock.mockResolvedValueOnce(favorites([ANA, BRUNO])).mockResolvedValueOnce(favorites([BRUNO]));
      removeMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<FavoritesView />);
      await screen.findByRole("heading", { name: "Ana Lima" });

      await user.click(screen.getByRole("button", { name: removeLabel(ANA) }));

      await waitFor(() => expect(screen.queryByRole("heading", { name: "Ana Lima" })).toBeNull());
      expect(screen.getByRole("heading", { name: "Bruno Reis" })).toBeTruthy();
      expect(removeMock).toHaveBeenCalledWith("ana-lima");
      expect(fetchFavoritesMock).toHaveBeenCalledTimes(2);
    });

    it("drops a removed talent from the comparison selection", async () => {
      fetchFavoritesMock.mockResolvedValueOnce(favorites([ANA, BRUNO])).mockResolvedValueOnce(favorites([BRUNO]));
      removeMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<FavoritesView />);
      await screen.findByRole("heading", { name: "Ana Lima" });
      await user.click(compareCheckboxes()[0]);
      expect(screen.getByText("1 de 2 talentos selecionados.")).toBeTruthy();

      await user.click(screen.getByRole("button", { name: removeLabel(ANA) }));

      await waitFor(() => expect(screen.queryByText("1 de 2 talentos selecionados.")).toBeNull());
    });

    it("refreshes the list when a favorite is added back", async () => {
      const unfavorited = { ...ANA, favorito: false };
      fetchFavoritesMock.mockResolvedValue(favorites([unfavorited]));
      addMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<FavoritesView />);
      await screen.findByRole("heading", { name: "Ana Lima" });

      await user.click(screen.getByRole("button", { name: `Adicionar aos favoritos: ${ANA.nomeCompleto}` }));

      await waitFor(() => expect(fetchFavoritesMock).toHaveBeenCalledTimes(2));
      expect(addMock).toHaveBeenCalledWith("ana-lima");
    });

    it.each([
      { page: 3, expectedPath: `${FAVORITES_PATH}?page=2` },
      { page: 2, expectedPath: FAVORITES_PATH },
    ])("goes back to the previous page when the last favorite of page $page is removed", async ({ page, expectedPath }) => {
      setPage(String(page));
      fetchFavoritesMock.mockResolvedValue(favorites([ANA], page, page));
      removeMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<FavoritesView />);
      await screen.findByRole("heading", { name: "Ana Lima" });

      await user.click(screen.getByRole("button", { name: removeLabel(ANA) }));

      await waitFor(() => expect(nav.router.push).toHaveBeenCalledWith(expectedPath));
      expect(fetchFavoritesMock).toHaveBeenCalledTimes(1);
    });

    it("stays on the page when other favorites remain after a removal", async () => {
      setPage("2");
      fetchFavoritesMock.mockResolvedValueOnce(favorites([ANA, BRUNO], 2, 2)).mockResolvedValueOnce(favorites([BRUNO], 2, 2));
      removeMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<FavoritesView />);
      await screen.findByRole("heading", { name: "Ana Lima" });

      await user.click(screen.getByRole("button", { name: removeLabel(ANA) }));

      await waitFor(() => expect(fetchFavoritesMock).toHaveBeenCalledTimes(2));
      expect(nav.router.push).not.toHaveBeenCalled();
    });

    it("warns and refreshes when a favorite's profile is no longer available, and lets the user dismiss the notice", async () => {
      fetchFavoritesMock.mockResolvedValueOnce(favorites([ANA, BRUNO])).mockResolvedValueOnce(favorites([BRUNO]));
      removeMock.mockRejectedValue(new ApiError(NOT_FOUND, "Not found"));
      const user = userEvent.setup();
      render(<FavoritesView />);
      await screen.findByRole("heading", { name: "Ana Lima" });

      await user.click(screen.getByRole("button", { name: removeLabel(ANA) }));

      const notice = await screen.findByText(UNAVAILABLE);
      await waitFor(() => expect(screen.queryByRole("heading", { name: "Ana Lima" })).toBeNull());
      expect(fetchFavoritesMock).toHaveBeenCalledTimes(2);

      await user.click(within(notice.closest("[role='alert']") as HTMLElement).getByRole("button", { name: /close|fechar/i }));
      expect(screen.queryByText(UNAVAILABLE)).toBeNull();
    });

    it("goes back a page when the unavailable favorite was the only one on a later page", async () => {
      setPage("2");
      fetchFavoritesMock.mockResolvedValue(favorites([ANA], 2, 2));
      removeMock.mockRejectedValue(new ApiError(NOT_FOUND, "Not found"));
      const user = userEvent.setup();
      render(<FavoritesView />);
      await screen.findByRole("heading", { name: "Ana Lima" });

      await user.click(screen.getByRole("button", { name: removeLabel(ANA) }));

      await waitFor(() => expect(nav.router.push).toHaveBeenCalledWith(FAVORITES_PATH));
      expect(screen.getByText(UNAVAILABLE)).toBeTruthy();
    });
  });

  describe("profile preview", () => {
    it("opens the preview for the chosen talent and closes it again", async () => {
      fetchFavoritesMock.mockResolvedValue(favorites([ANA]));
      fetchTalentMock.mockResolvedValue(makeTalentProfile({ slug: "ana-lima", nomeCompleto: "Ana Lima", favorito: true }));
      const user = userEvent.setup();
      render(<FavoritesView />);
      await screen.findByRole("heading", { name: "Ana Lima" });
      expect(screen.queryByRole("dialog")).toBeNull();

      await user.click(screen.getByRole("button", { name: "Abrir prévia de Ana Lima" }));

      const dialog = await screen.findByRole("dialog");
      expect(await within(dialog).findByRole("link", { name: /Ver perfil completo/ })).toBeTruthy();
      expect(fetchTalentMock).toHaveBeenCalledWith("ana-lima");

      await user.click(within(dialog).getByRole("button", { name: "Fechar prévia" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("refreshes the list when the favorite is removed from the preview", async () => {
      fetchFavoritesMock.mockResolvedValueOnce(favorites([ANA])).mockResolvedValueOnce(favorites([]));
      fetchTalentMock.mockResolvedValue(makeTalentProfile({ slug: "ana-lima", nomeCompleto: "Ana Lima", favorito: true }));
      removeMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<FavoritesView />);
      await screen.findByRole("heading", { name: "Ana Lima" });
      await user.click(screen.getByRole("button", { name: "Abrir prévia de Ana Lima" }));
      const dialog = await screen.findByRole("dialog");

      await user.click(await within(dialog).findByRole("button", { name: removeLabel(ANA) }));

      await waitFor(() => expect(fetchFavoritesMock).toHaveBeenCalledTimes(2));
      expect(removeMock).toHaveBeenCalledWith("ana-lima");
    });

    it("warns and refreshes when the previewed profile is no longer available", async () => {
      fetchFavoritesMock.mockResolvedValueOnce(favorites([ANA])).mockResolvedValueOnce(favorites([]));
      fetchTalentMock.mockRejectedValue(new ApiError(NOT_FOUND, "Not found"));
      const user = userEvent.setup();
      render(<FavoritesView />);
      await screen.findByRole("heading", { name: "Ana Lima" });

      await user.click(screen.getByRole("button", { name: "Abrir prévia de Ana Lima" }));

      await waitFor(() => expect(fetchFavoritesMock).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.getAllByText(UNAVAILABLE)).toHaveLength(2)); // the page alert plus the notice inside the open dialog
    });
  });
});
