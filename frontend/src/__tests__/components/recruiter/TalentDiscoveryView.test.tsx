import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TalentDiscoveryView } from "@/components/recruiter/TalentDiscoveryView";
import { ApiError } from "@/lib/api";
import type { PaginatedResponse, TalentListItem, TalentProfile } from "@/types/recruiter";
import type { CatalogoCompetenciaResponse } from "@/types/student";
import { makeFilters, makeTalentPage } from "./recruiterDiscoveryFixtures";
import { makeTalentListItem, makeTalentProfile } from "./recruiterFixtures";

vi.setConfig({ testTimeout: 15_000 });

const mocks = vi.hoisted(() => ({
  fetchTalents: vi.fn(),
  fetchRecruiterCompetencies: vi.fn(),
  fetchTalent: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
  push: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("@/lib/recruiter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/recruiter")>()),
  fetchTalents: mocks.fetchTalents,
  fetchRecruiterCompetencies: mocks.fetchRecruiterCompetencies,
  fetchTalent: mocks.fetchTalent,
  addFavorite: mocks.addFavorite,
  removeFavorite: mocks.removeFavorite,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => PATHNAME,
  useSearchParams: () => mocks.params,
}));

const PATHNAME = "/recrutador/talentos";
const UNAVAILABLE = "Este perfil não está mais disponível.";
const SEARCH_FALLBACK = "Não foi possível buscar talentos.";
const EMPTY_TITLE = "Nenhum talento encontrado";
const CLEAR_FILTERS = "Limpar filtros";
const RETRY = "Tentar novamente";
const MAX_TWO = "A comparação permite selecionar apenas dois talentos.";

const MARIA = makeTalentListItem();
const JOAO = makeTalentListItem({ id: "talento-2", slug: "joao-lima", nomeCompleto: "João Lima", competencias: [{ id: 2, nome: "Python" }] });
const ANA = makeTalentListItem({ id: "talento-3", slug: "ana-reis", nomeCompleto: "Ana Reis", competencias: [] });
const CATALOG: CatalogoCompetenciaResponse[] = [
  { id: 1, nome: "React" },
  { id: 2, nome: "Python" },
];

function setQuery(query: string) {
  mocks.params = new URLSearchParams(query);
}

function renderView(query = "") {
  setQuery(query);
  return render(<TalentDiscoveryView />);
}

async function renderLoaded(items: TalentListItem[] = [MARIA, JOAO], query = "") {
  mocks.fetchTalents.mockResolvedValue(makeTalentPage(items));
  renderView(query);
  await screen.findByText(items[0].nomeCompleto);
}

function card(name: string) {
  const article = screen.getByRole("heading", { level: 2, name }).closest("article");
  if (!article) throw new Error(`No card for ${name}`);
  return within(article);
}

function activeFilters() {
  const row = screen.getByText("Filtros ativos:").parentElement;
  if (!row) throw new Error("No active filters row");
  return within(row);
}

/** Both filter buttons are in the DOM (one per breakpoint); the first opens the dialog, the last the drawer. */
function filterButtons() {
  return screen.getAllByRole("button", { name: /^Filtros/, hidden: true });
}

function lastPushedUrl(): string {
  const calls = mocks.push.mock.calls;
  return calls[calls.length - 1][0];
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("TalentDiscoveryView", () => {
  beforeEach(() => {
    setQuery("");
    mocks.fetchTalents.mockResolvedValue(makeTalentPage([MARIA, JOAO]));
    mocks.fetchRecruiterCompetencies.mockResolvedValue(CATALOG);
    mocks.fetchTalent.mockResolvedValue(makeTalentProfile());
    mocks.addFavorite.mockResolvedValue(undefined);
    mocks.removeFavorite.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe("loading and results", () => {
    it("shows placeholders and a searching message while the talents load", () => {
      mocks.fetchTalents.mockReturnValue(new Promise(() => undefined));
      renderView();
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Explorar talentos");
      expect(screen.getByText("Buscando…")).toBeTruthy();
      expect(screen.queryByRole("article")).toBeNull();
      expect(screen.queryByText(EMPTY_TITLE)).toBeNull();
    });

    it("lists the talents and the total found", async () => {
      mocks.fetchTalents.mockResolvedValue(makeTalentPage([MARIA, JOAO], { totalItems: 12 }));
      renderView();
      expect(await screen.findByText("Maria Souza")).toBeTruthy();
      expect(screen.getByText("João Lima")).toBeTruthy();
      expect(screen.getAllByRole("article")).toHaveLength(2);
      expect(screen.getByText("12 talento(s) encontrado(s)")).toBeTruthy();
      expect(screen.queryByText("Buscando…")).toBeNull();
    });

    it("searches with the criteria parsed from the URL", async () => {
      await renderLoaded([MARIA], "nome=Ana&uf=mg&page=2&competenciaIds=1&competenciaIds=2&rpvVerificado=true&ordenacao=nome&modalidades=remoto");
      expect(mocks.fetchTalents).toHaveBeenCalledTimes(1);
      expect(mocks.fetchTalents).toHaveBeenCalledWith(makeFilters({
        nome: "Ana", uf: "MG", page: 2, competenciaIds: [1, 2], rpvVerificado: true, ordenacao: "NOME", modalidades: ["REMOTO"],
      }));
    });

    it("loads the competency catalog once", async () => {
      await renderLoaded();
      expect(mocks.fetchRecruiterCompetencies).toHaveBeenCalledTimes(1);
    });

    it("shows the empty state without a clear action when nothing is filtered", async () => {
      mocks.fetchTalents.mockResolvedValue(makeTalentPage([], { totalItems: 0, totalPages: 0 }));
      renderView();
      expect(await screen.findByText(EMPTY_TITLE)).toBeTruthy();
      expect(screen.getByText("Tente ajustar os critérios da busca.")).toBeTruthy();
      expect(screen.getByText("0 talento(s) encontrado(s)")).toBeTruthy();
      expect(screen.queryByRole("button", { name: CLEAR_FILTERS })).toBeNull();
    });

    it("offers to clear the filters in the empty state when a search has criteria", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.fetchTalents.mockResolvedValue(makeTalentPage([], { totalItems: 0, totalPages: 0 }));
      renderView("nome=Zelda");
      await screen.findByText(EMPTY_TITLE);
      const clearButtons = screen.getAllByRole("button", { name: CLEAR_FILTERS });
      expect(clearButtons).toHaveLength(2);
      await user.click(clearButtons[1]);
      expect(mocks.push).toHaveBeenCalledWith(PATHNAME);
    });
  });

  describe("failures", () => {
    it("shows the API error without the empty state and retries the search", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.fetchTalents.mockRejectedValueOnce(new ApiError(500, "Busca indisponível"));
      renderView();
      expect((await screen.findByRole("alert")).textContent).toContain("Busca indisponível");
      expect(screen.queryByText(EMPTY_TITLE)).toBeNull();

      await user.click(screen.getByRole("button", { name: RETRY }));
      expect(await screen.findByText("Maria Souza")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
      expect(mocks.fetchTalents).toHaveBeenCalledTimes(2);
    });

    it("falls back to a generic message when the rejection has no text", async () => {
      mocks.fetchTalents.mockRejectedValue(null);
      renderView();
      expect((await screen.findByRole("alert")).textContent).toContain(SEARCH_FALLBACK);
    });

    it("shows the loading state while the retry is in flight", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.fetchTalents.mockRejectedValueOnce(new ApiError(500, "Busca indisponível"));
      renderView();
      await screen.findByRole("alert");
      mocks.fetchTalents.mockReturnValue(new Promise(() => undefined));

      await user.click(screen.getByRole("button", { name: RETRY }));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByText("Buscando…")).toBeTruthy();
    });
  });

  describe("sorting", () => {
    it("shows the sort order of the URL as selected", async () => {
      await renderLoaded([MARIA], "ordenacao=recentes");
      expect(screen.getByRole("combobox", { name: "Ordenar por" }).textContent).toBe("Mais recentes");
    });

    it("navigates to the first page with the chosen sort order and keeps the filters", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded([MARIA], "nome=Ana&page=3");
      await user.click(screen.getByRole("combobox", { name: "Ordenar por" }));
      await user.click(screen.getByRole("option", { name: "Nome" }));
      expect(mocks.push).toHaveBeenCalledTimes(1);
      expect(lastPushedUrl()).toBe(`${PATHNAME}?nome=Ana&ordenacao=nome`);
    });

    it("removes the sort order when the default is chosen", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded([MARIA], "ordenacao=relevancia");
      await user.click(screen.getByRole("combobox", { name: "Ordenar por" }));
      await user.click(screen.getByRole("option", { name: "Padrão" }));
      expect(lastPushedUrl()).toBe(PATHNAME);
    });
  });

  describe("pagination", () => {
    it("navigates to the chosen page keeping the criteria", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.fetchTalents.mockResolvedValue(makeTalentPage([MARIA], { page: 1, totalPages: 3, totalItems: 25 }));
      renderView("cidade=Ub%C3%A1");
      await screen.findByText("Maria Souza");
      const pagination = screen.getByRole("navigation", { name: "Paginação de talentos" });
      await user.click(within(pagination).getByRole("button", { name: /page 3/i }));
      expect(lastPushedUrl()).toBe(`${PATHNAME}?page=3&cidade=Ub%C3%A1`);
    });

    it("marks the current page of the result", async () => {
      mocks.fetchTalents.mockResolvedValue(makeTalentPage([MARIA], { page: 2, totalPages: 3, totalItems: 25 }));
      renderView("page=2");
      await screen.findByText("Maria Souza");
      const pagination = screen.getByRole("navigation", { name: "Paginação de talentos" });
      expect(within(pagination).getByRole("button", { name: /page 2/i }).getAttribute("aria-current")).toBe("page");
    });

    it("does not show pagination for a single page", async () => {
      await renderLoaded();
      expect(screen.queryByRole("navigation", { name: "Paginação de talentos" })).toBeNull();
    });
  });

  describe("active filters", () => {
    it("counts the filter criteria in the filter buttons and lists them as chips with readable names", async () => {
      await renderLoaded([MARIA], [
        "nome=Ana", "cidade=Ub%C3%A1", "uf=MG", "competenciaIds=1", "competenciaIds=2", "competenciaIds=99",
        "tiposFormacao=TECNICO", "formacaoNome=Inform%C3%A1tica", "statusFormacao=CONCLUIDO", "rpvVerificado=true",
        "disponibilidades=CLT", "modalidades=HIBRIDO",
      ].join("&"));
      expect(filterButtons().map((button) => button.textContent)).toEqual(["Filtros (10)", "Filtros (10)"]);
      const chips = ["Nome: Ana", "Cidade: Ubá", "UF: MG", "React", "Python", "Competência #99", "Técnico", "Formação: Informática",
        "Concluído", "RPV verificado", "CLT", "Híbrido"];
      chips.forEach((label) => expect(activeFilters().getByText(label)).toBeTruthy());
    });

    it("uses the competency id as label until the catalog loads", async () => {
      const catalog = deferred<CatalogoCompetenciaResponse[]>();
      mocks.fetchRecruiterCompetencies.mockReturnValue(catalog.promise);
      await renderLoaded([MARIA], "competenciaIds=1");
      expect(activeFilters().getByText("Competência #1")).toBeTruthy();
      catalog.resolve(CATALOG);
      expect(await activeFilters().findByText("React")).toBeTruthy();
      expect(screen.queryByText("Competência #1")).toBeNull();
    });

    it("shows plain filter buttons and no chips when nothing is filtered", async () => {
      await renderLoaded();
      expect(filterButtons().map((button) => button.textContent)).toEqual(["Filtros", "Filtros"]);
      expect(screen.queryByText("Filtros ativos:")).toBeNull();
    });

    it("clears every filter from the chip row by navigating to the bare path", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded([MARIA], "nome=Ana&uf=MG");
      expect(screen.getByText("Filtros ativos:")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: CLEAR_FILTERS }));
      expect(mocks.push).toHaveBeenCalledWith(PATHNAME);
    });
  });

  describe("filter panels", () => {
    it.each([
      ["dialog", 0],
      ["drawer", 1],
    ] as const)("opens the filters in the %s and closes them with the close button", async (_kind, index) => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.click(filterButtons()[index]);
      expect(screen.getByRole("button", { name: "Aplicar" })).toBeTruthy();
      expect(screen.getByLabelText("Nome")).toBeTruthy();

      await user.click(screen.getByRole("button", { name: "Fechar filtros" }));
      await waitFor(() => expect(screen.queryByRole("button", { name: "Aplicar" })).toBeNull());
    });

    it.each([
      ["dialog", 0],
      ["drawer", 1],
    ] as const)("closes the %s with Escape without navigating", async (_kind, index) => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.click(filterButtons()[index]);
      expect(screen.getByRole("button", { name: "Aplicar" })).toBeTruthy();

      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("button", { name: "Aplicar" })).toBeNull());
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it("starts the panel with the criteria of the current search", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded([MARIA], "nome=Ana&uf=MG&disponibilidades=CLT");
      await user.click(filterButtons()[1]);
      expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Ana");
      expect((screen.getByLabelText("UF") as HTMLInputElement).value).toBe("MG");
      expect((screen.getByRole("checkbox", { name: "CLT" }) as HTMLInputElement).checked).toBe(true);
    });

    it("applies the edited criteria, going back to the first page and closing the panel", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded([MARIA], "page=3&ordenacao=nome");
      await user.click(filterButtons()[1]);
      await user.type(screen.getByLabelText("Nome"), "Ana");
      await user.click(screen.getByRole("checkbox", { name: "Remoto" }));
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(mocks.push).toHaveBeenCalledTimes(1);
      expect(lastPushedUrl()).toBe(`${PATHNAME}?nome=Ana&modalidades=REMOTO&ordenacao=nome`);
      await waitFor(() => expect(screen.queryByRole("button", { name: "Aplicar" })).toBeNull());
    });

    it("applies from the dialog too", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.click(filterButtons()[0]);
      await user.type(screen.getByLabelText("Cidade"), "Ubá");
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(lastPushedUrl()).toBe(`${PATHNAME}?cidade=Ub%C3%A1`);
    });

    it("does not navigate when the criteria are invalid", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.click(filterButtons()[1]);
      await user.type(screen.getByLabelText("UF"), "zz");
      await user.click(screen.getByRole("button", { name: "Aplicar" }));
      expect(screen.getByRole("alert").textContent).toBe("Selecione uma UF válida.");
      expect(mocks.push).not.toHaveBeenCalled();
    });

    it("clears the criteria and the sort order of an active search", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded([MARIA], "nome=Ana&ordenacao=nome");
      await user.click(filterButtons()[1]);
      await user.click(screen.getByRole("button", { name: "Limpar" }));
      expect(mocks.push).toHaveBeenCalledWith(PATHNAME);
      await waitFor(() => expect(screen.queryByRole("button", { name: "Aplicar" })).toBeNull());
    });

    it("clears a search that only has a sort order or a page", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded([MARIA], "page=2");
      await user.click(filterButtons()[1]);
      await user.click(screen.getByRole("button", { name: "Limpar" }));
      expect(mocks.push).toHaveBeenCalledWith(PATHNAME);
    });

    it("only resets the panel, without navigating, when there is nothing to clear", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.click(filterButtons()[1]);
      await user.type(screen.getByLabelText("Nome"), "Ana");
      await user.click(screen.getByRole("button", { name: "Limpar" }));
      expect(mocks.push).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole("button", { name: "Aplicar" })).toBeNull());
      await user.click(filterButtons()[1]);
      expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("");
    });

    it("warns when the competency catalog is unavailable and reloads it on retry", async () => {
      const user = userEvent.setup({ delay: null });
      mocks.fetchRecruiterCompetencies.mockRejectedValueOnce(new ApiError(403, "Forbidden"));
      await renderLoaded();
      await waitFor(() => expect(mocks.fetchRecruiterCompetencies).toHaveBeenCalledTimes(1));
      await user.click(filterButtons()[1]);
      expect((await screen.findByRole("alert")).textContent).toContain("O catálogo de competências não está disponível para esta conta.");

      await user.click(screen.getByRole("button", { name: RETRY }));
      await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
      expect(mocks.fetchRecruiterCompetencies).toHaveBeenCalledTimes(2);
      await user.click(screen.getByLabelText("Competências"));
      expect(screen.getByRole("option", { name: "React" })).toBeTruthy();
    });
  });

  describe("favorites", () => {
    it("favorites a talent and updates only that card", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.click(card("Maria Souza").getByRole("button", { name: "Adicionar aos favoritos: Maria Souza" }));
      expect(mocks.addFavorite).toHaveBeenCalledWith("maria-souza");
      expect(await card("Maria Souza").findByRole("button", { name: "Remover dos favoritos: Maria Souza" })).toBeTruthy();
      expect(card("João Lima").getByRole("button", { name: "Adicionar aos favoritos: João Lima" })).toBeTruthy();
    });

    it("removes a favorite", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded([makeTalentListItem({ favorito: true }), JOAO]);
      await user.click(card("Maria Souza").getByRole("button", { name: "Remover dos favoritos: Maria Souza" }));
      expect(mocks.removeFavorite).toHaveBeenCalledWith("maria-souza");
      expect(await card("Maria Souza").findByRole("button", { name: "Adicionar aos favoritos: Maria Souza" })).toBeTruthy();
    });

    it("warns, refreshes the list and drops the talent from the selection when the profile is gone", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.click(card("Maria Souza").getByRole("checkbox", { name: "Comparar" }));
      expect(screen.getByText("1 talento selecionado. Selecione mais 1 para comparar.")).toBeTruthy();

      mocks.fetchTalents.mockResolvedValue(makeTalentPage([JOAO]));
      mocks.addFavorite.mockRejectedValue(new ApiError(404, "Not found"));
      await user.click(card("Maria Souza").getByRole("button", { name: "Adicionar aos favoritos: Maria Souza" }));

      expect((await screen.findByRole("alert")).textContent).toBe(UNAVAILABLE);
      await waitFor(() => expect(screen.queryByText("Maria Souza")).toBeNull());
      expect(mocks.fetchTalents).toHaveBeenCalledTimes(2);
      expect(screen.queryByText(/talento selecionado/)).toBeNull();
    });

    it("lets the user dismiss the unavailable-profile notice", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      mocks.addFavorite.mockRejectedValue(new ApiError(404, "Not found"));
      await user.click(card("Maria Souza").getByRole("button", { name: "Adicionar aos favoritos: Maria Souza" }));
      await screen.findByText(UNAVAILABLE);
      await user.click(screen.getByRole("button", { name: "Close" }));
      await waitFor(() => expect(screen.queryByText(UNAVAILABLE)).toBeNull());
    });
  });

  describe("comparison", () => {
    function box(name: string) {
      return card(name).getByRole("checkbox", { name: "Comparar" }) as HTMLInputElement;
    }

    it("shows no comparison bar until a talent is selected", async () => {
      await renderLoaded();
      expect(screen.queryByRole("button", { name: "Comparar talentos" })).toBeNull();
      expect(box("Maria Souza").checked).toBe(false);
    });

    it("asks for a second talent while only one is selected", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.click(box("Maria Souza"));
      expect(box("Maria Souza").checked).toBe(true);
      expect(screen.getByText("1 talento selecionado. Selecione mais 1 para comparar.")).toBeTruthy();
      expect((screen.getByRole("button", { name: "Comparar talentos" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("compares the two selected talents in the order they were chosen", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded();
      await user.click(box("João Lima"));
      await user.click(box("Maria Souza"));
      expect(screen.getByText("2 talentos selecionados para comparação.")).toBeTruthy();
      const compare = screen.getByRole("button", { name: "Comparar talentos" }) as HTMLButtonElement;
      expect(compare.disabled).toBe(false);
      await user.click(compare);
      expect(mocks.push).toHaveBeenCalledWith("/recrutador/comparar?slugs=joao-lima&slugs=maria-souza");
    });

    it("does not allow a third talent and explains the limit", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded([MARIA, JOAO, ANA]);
      await user.click(box("Maria Souza"));
      await user.click(box("João Lima"));
      await user.click(box("Ana Reis"));
      expect(screen.getByText(MAX_TWO)).toBeTruthy();
      expect(box("Ana Reis").checked).toBe(false);
      expect(screen.getByText("2 talentos selecionados para comparação.")).toBeTruthy();
    });

    it("frees a slot when a selected talent is unchecked and clears the limit message", async () => {
      const user = userEvent.setup({ delay: null });
      await renderLoaded([MARIA, JOAO, ANA]);
      await user.click(box("Maria Souza"));
      await user.click(box("João Lima"));
      await user.click(box("Ana Reis"));
      expect(screen.getByText(MAX_TWO)).toBeTruthy();

      await user.click(box("Maria Souza"));
      expect(screen.queryByText(MAX_TWO)).toBeNull();
      expect(box("Maria Souza").checked).toBe(false);
      expect(screen.getByText("1 talento selecionado. Selecione mais 1 para comparar.")).toBeTruthy();

      await user.click(box("Ana Reis"));
      expect(box("Ana Reis").checked).toBe(true);
      expect(screen.getByText("2 talentos selecionados para comparação.")).toBeTruthy();
    });
  });

  describe("profile preview", () => {
    async function openPreview(name = "Maria Souza") {
      const user = userEvent.setup({ delay: null });
      await user.click(screen.getByRole("button", { name: `Abrir prévia de ${name}` }));
      return { user, dialog: await screen.findByRole("dialog", { name: "Prévia do perfil" }) };
    }

    it("loads the profile of the chosen talent in a dialog and closes it", async () => {
      await renderLoaded();
      const { user, dialog } = await openPreview("João Lima");
      expect(mocks.fetchTalent).toHaveBeenCalledWith("joao-lima");
      expect(await within(dialog).findByRole("heading", { level: 2, name: "Maria Souza" })).toBeTruthy();

      await user.click(within(dialog).getByRole("button", { name: "Fechar prévia" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("updates the list card when the talent is favorited from the preview", async () => {
      await renderLoaded();
      const { user, dialog } = await openPreview();
      await user.click(await within(dialog).findByRole("button", { name: "Adicionar aos favoritos: Maria Souza" }));
      expect(mocks.addFavorite).toHaveBeenCalledWith("maria-souza");
      await waitFor(() => expect(within(dialog).getByRole("button", { name: "Remover dos favoritos: Maria Souza" })).toBeTruthy());

      await user.click(within(dialog).getByRole("button", { name: "Fechar prévia" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(card("Maria Souza").getByRole("button", { name: "Remover dos favoritos: Maria Souza" })).toBeTruthy();
      expect(card("João Lima").getByRole("button", { name: "Adicionar aos favoritos: João Lima" })).toBeTruthy();
    });

    it("warns and refreshes the list when the previewed profile no longer exists", async () => {
      await renderLoaded();
      mocks.fetchTalent.mockRejectedValue(new ApiError(404, "Not found"));
      mocks.fetchTalents.mockResolvedValue(makeTalentPage([JOAO]));
      const { dialog } = await openPreview();
      expect(await within(dialog).findByText(UNAVAILABLE)).toBeTruthy();
      await waitFor(() => expect(mocks.fetchTalents).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByText("Maria Souza", { selector: "h2" })).toBeNull());
      expect(screen.getAllByText(UNAVAILABLE)).toHaveLength(2); // the page alert plus the notice inside the open dialog
    });

    it("warns even when the previewed talent already left the list", async () => {
      await renderLoaded();
      const profile = deferred<TalentProfile>();
      mocks.fetchTalent.mockReturnValue(profile.promise);
      const { user } = await openPreview();

      // Covers the defensive branch of previewUnavailable: the previewed talent is no longer in the list when the
      // preview reports 404. While the preview is loading, another talent turns out to be unavailable and the list
      // refreshes without Maria. The card is behind the modal, hence hidden: true.
      mocks.fetchTalents.mockResolvedValue(makeTalentPage([JOAO]));
      mocks.addFavorite.mockRejectedValue(new ApiError(404, "Not found"));
      const joaoFavorite = screen.getByRole("button", { name: "Adicionar aos favoritos: João Lima", hidden: true });
      await user.click(joaoFavorite);
      await waitFor(() => expect(screen.queryByRole("heading", { level: 2, name: "Maria Souza", hidden: true })).toBeNull());

      profile.reject(new ApiError(404, "Not found"));
      expect(await within(await screen.findByRole("dialog")).findByText(UNAVAILABLE)).toBeTruthy();
      expect(screen.getAllByText(UNAVAILABLE)).toHaveLength(2); // the page alert plus the notice inside the open dialog
      expect(mocks.fetchTalents).toHaveBeenCalledTimes(2);
    });
  });

  describe("page response shape", () => {
    it("does not break on an empty page that still reports more pages", async () => {
      const response: PaginatedResponse<TalentListItem> = makeTalentPage([], { page: 4, totalPages: 4, totalItems: 31 });
      mocks.fetchTalents.mockResolvedValue(response);
      renderView("page=4");
      expect(await screen.findByText(EMPTY_TITLE)).toBeTruthy();
      expect(screen.getByText("31 talento(s) encontrado(s)")).toBeTruthy();
      expect(screen.getByRole("navigation", { name: "Paginação de talentos" })).toBeTruthy();
    });
  });
});
