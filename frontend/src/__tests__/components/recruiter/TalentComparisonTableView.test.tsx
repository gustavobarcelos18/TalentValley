import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TalentComparisonTableView } from "@/components/recruiter/TalentComparisonTableView";
import { ApiError, apiDownload } from "@/lib/api";
import { fetchTalent } from "@/lib/recruiter";
import type { TalentProfile } from "@/types/recruiter";
import { makeFormation, makeTalentBusca, makeTalentProfile } from "./recruiterFixtures";
import { renderThemed as render } from "./renderThemed";

vi.setConfig({ testTimeout: 15_000 });

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }));
vi.mock("@/hooks/useProtectedFile", () => ({
  useProtectedFile: () => ({ url: null, loading: false, error: null, reload: vi.fn() }),
}));
vi.mock("@/lib/recruiter", () => ({ fetchTalent: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiDownload: vi.fn(),
}));

const fetchMock = vi.mocked(fetchTalent);
const downloadMock = vi.mocked(apiDownload);

const SLUG_A = "ana-lima";
const SLUG_B = "bruno-reis";
const NOT_FOUND = 404;
const SERVER_ERROR = 500;
const SELECT_TWO = "Selecione exatamente dois talentos para comparar.";
const MISSING = "Não informado";
const UNSAFE_URL = "javascript:alert(1)";

function profileA(overrides: Partial<TalentProfile> = {}): TalentProfile {
  return makeTalentProfile({
    id: "talento-1",
    slug: SLUG_A,
    nomeCompleto: "Ana Lima",
    competencias: [
      { id: 1, nome: "React", tipo: "TECNICA" },
      { id: 2, nome: "Comunicação", tipo: "COMPORTAMENTAL" },
    ],
    formacoes: [
      makeFormation({ id: "f-1", nome: "Sistemas de Informação", cargaHoraria: 3200, principal: true, rpvVerificado: true }),
      makeFormation({
        id: "f-2", nome: "Curso de Docker", instituicao: "Escola Online", tipo: "CURSO_LIVRE", principal: false,
        status: "CONCLUIDO", dataInicio: "2024-03-01", dataFim: "2024-06-30", possuiCertificado: true, certificadoUrl: "/api/talentos/ana-lima/formacoes/f-2/certificado",
      }),
    ],
    experiencias: [{
      id: "e-1", empresa: "Acme", cargo: "Desenvolvedora", tipo: "ESTAGIO", dataInicio: "2025-01-10", dataFim: null,
      atual: true, descricao: "Manutenção de APIs.",
    }],
    projetos: [{
      id: "p-1", ordem: 1, nome: "Portal do Aluno", dataInicio: "2025-02-01", dataFim: null, emAndamento: true,
      descricao: "Portal para alunos.", demoUrl: "https://demo.example.com", repositorioUrl: "https://github.com/ana/portal",
      tecnologias: [{ id: 1, nome: "React", tipo: "TECNICA" }],
    }],
    busca: makeTalentBusca({ objetivo: "Atuar com front-end.", areasInteresse: ["DesenvolvimentoFrontend"], cargaHoraria: "ATE_30H", disponivelImediatamente: true, aceitaViajar: true }),
    curriculo: { possuiCurriculo: true, url: "/api/talentos/ana-lima/curriculo" },
    ...overrides,
  });
}

function profileB(overrides: Partial<TalentProfile> = {}): TalentProfile {
  return makeTalentProfile({
    id: "talento-2",
    slug: SLUG_B,
    nomeCompleto: "Bruno Reis",
    cidade: null,
    uf: null,
    competencias: [],
    idiomas: [],
    disponibilidades: [],
    modalidades: [],
    contato: { telefone: null, emailProfissional: null, linkedInUrl: null, gitHubUrl: null, portfolioUrl: null },
    ...overrides,
  });
}

function setSlugs(...slugs: string[]) {
  const params = new URLSearchParams();
  for (const slug of slugs) params.append("slugs", slug);
  nav.params = params;
}

async function renderTable(a: TalentProfile = profileA(), b: TalentProfile = profileB()) {
  setSlugs(SLUG_A, SLUG_B);
  fetchMock.mockImplementation((slug) => Promise.resolve(slug === SLUG_A ? a : b));
  render(<TalentComparisonTableView />);
  await screen.findByRole("table", { name: "Tabela de currículos" });
}

/** The two value cells (candidate A, candidate B) of the row with this label. */
function row(label: string): [HTMLElement, HTMLElement] {
  const header = screen.getByRole("rowheader", { name: label });
  const cells = within(header.closest("tr") as HTMLElement).getAllByRole("cell");
  return [cells[0], cells[1]];
}

afterEach(() => {
  vi.resetAllMocks();
  nav.params = new URLSearchParams();
});

describe("TalentComparisonTableView", () => {
  describe("invalid selection", () => {
    it.each([
      { description: "no slugs", slugs: [] as string[] },
      { description: "a single slug", slugs: [SLUG_A] },
      { description: "three slugs", slugs: [SLUG_A, SLUG_B, "carla"] },
      { description: "identical slugs", slugs: [SLUG_A, SLUG_A] },
      { description: "a blank slug", slugs: ["   ", SLUG_B] },
    ])("asks for exactly two talents with $description and does not fetch", ({ slugs }) => {
      setSlugs(...slugs);
      render(<TalentComparisonTableView />);

      expect(screen.getByRole("heading", { level: 1, name: SELECT_TWO })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Explorar talentos" }).getAttribute("href")).toBe("/recrutador/talentos");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("loading and failures", () => {
    it("shows skeletons while the profiles load and requests each slug", () => {
      setSlugs(SLUG_A, SLUG_B);
      fetchMock.mockReturnValue(new Promise<TalentProfile>(() => undefined));
      const { container } = render(<TalentComparisonTableView />);

      expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledWith(SLUG_A);
      expect(fetchMock).toHaveBeenCalledWith(SLUG_B);
    });

    it("shows a dedicated message when one of the talents is no longer available (404)", async () => {
      setSlugs(SLUG_A, SLUG_B);
      fetchMock.mockImplementation((slug) => slug === SLUG_A ? Promise.resolve(profileA()) : Promise.reject(new ApiError(NOT_FOUND, "Not found")));
      render(<TalentComparisonTableView />);

      expect((await screen.findByRole("alert")).textContent).toContain("Um dos perfis não está mais disponível.");
      expect(screen.queryByRole("table")).toBeNull();
    });

    it("shows the API error and retries successfully", async () => {
      setSlugs(SLUG_A, SLUG_B);
      fetchMock.mockRejectedValueOnce(new ApiError(SERVER_ERROR, "Falha no servidor"));
      fetchMock.mockImplementation((slug) => Promise.resolve(slug === SLUG_A ? profileA() : profileB()));
      const user = userEvent.setup();
      render(<TalentComparisonTableView />);

      expect((await screen.findByRole("alert")).textContent).toContain("Falha no servidor");
      await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

      expect(await screen.findByRole("table", { name: "Tabela de currículos" })).toBeTruthy();
    });

    it("falls back to the generic message for unknown failures", async () => {
      setSlugs(SLUG_A, SLUG_B);
      fetchMock.mockRejectedValue("boom");
      render(<TalentComparisonTableView />);

      expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível carregar a comparação.");
    });
  });

  describe("table content", () => {
    it("renders a column per candidate with the field names in the first column", async () => {
      await renderTable();

      expect(screen.getByRole("heading", { level: 1, name: "Comparar talentos" })).toBeTruthy();
      const headers = screen.getAllByRole("columnheader");
      expect(headers.map((header) => header.textContent)).toEqual(["Campo", "Candidato AAna Lima", "Candidato BBruno Reis"]);
      for (const section of ["Perfil profissional", "Formação", "Experiências", "Competências", "Idiomas", "Projetos", "Objetivos profissionais", "Disponibilidade", "Links profissionais", "Currículo"]) {
        expect(screen.getByRole("rowheader", { name: section })).toBeTruthy();
      }
    });

    it("shows the professional profile data", async () => {
      await renderTable();

      const [photoA, photoB] = row("Foto e nome");
      expect(photoA.textContent).toContain("Ana Lima");
      expect(photoB.textContent).toContain("Bruno Reis");
      expect(row("Cidade/UF")[0].textContent).toBe("Rio Pomba / MG");
      expect(row("Cidade/UF")[1].textContent).toBe(MISSING);
      expect(row("Atualizado em")[0].textContent).toMatch(/2026/);
    });

    it("splits the main formation from the others and shows every formation detail", async () => {
      await renderTable();

      const main = within(row("Formação principal")[0]);
      expect(main.getByText("Sistemas de Informação")).toBeTruthy();
      expect(main.getByText("IF Sudeste MG · Graduação")).toBeTruthy();
      expect(main.getByText("01/02/2022 — Não informado · Em andamento")).toBeTruthy();
      expect(main.getByText("Carga horária: 3200 h")).toBeTruthy();
      expect(main.getByText("Formação principal")).toBeTruthy();
      expect(main.getByText("Verificado pelo Rio Pomba Valley")).toBeTruthy();

      const others = within(row("Outras formações e cursos")[0]);
      expect(others.getByText("Curso de Docker")).toBeTruthy();
      expect(others.getByText("Escola Online · Curso livre")).toBeTruthy();
      expect(others.getByText("01/03/2024 — 30/06/2024 · Concluído")).toBeTruthy();
      expect(others.getByRole("button", { name: "Abrir certificado" })).toBeTruthy();
      expect(others.queryByText("Verificado pelo Rio Pomba Valley")).toBeNull();
    });

    it("shows experiences with type, period, current flag and description", async () => {
      await renderTable();

      const experiences = within(row("Experiências profissionais")[0]);
      expect(experiences.getByText("Desenvolvedora")).toBeTruthy();
      expect(experiences.getByText("Acme · Estágio")).toBeTruthy();
      expect(experiences.getByText("10/01/2025 — Atual (experiência atual)")).toBeTruthy();
      expect(experiences.getByText("Manutenção de APIs.")).toBeTruthy();
    });

    it("separates technical from behavioral competencies and languages", async () => {
      await renderTable(profileA({ idiomas: [{ idiomaId: 1, nome: "Inglês", nivel: "AVANCADO" }] }));

      expect(within(row("Competências técnicas")[0]).getByText("React")).toBeTruthy();
      expect(within(row("Competências técnicas")[0]).queryByText("Comunicação")).toBeNull();
      expect(within(row("Competências comportamentais")[0]).getByText("Comunicação")).toBeTruthy();
      expect(within(row("Idiomas e nível")[0]).getByText("Inglês · Avançado")).toBeTruthy();
    });

    it("shows projects with period, status, description, technologies and safe links", async () => {
      await renderTable();

      const projects = within(row("Projetos em destaque")[0]);
      expect(projects.getByText("Portal do Aluno")).toBeTruthy();
      expect(projects.getByText("01/02/2025 — Atual · Em andamento")).toBeTruthy();
      expect(projects.getByText("Portal para alunos.")).toBeTruthy();
      expect(projects.getByText("React")).toBeTruthy();
      expect(projects.getByRole("link", { name: "Demonstração" }).getAttribute("href")).toBe("https://demo.example.com");
      expect(projects.getByRole("link", { name: "Repositório" }).getAttribute("href")).toBe("https://github.com/ana/portal");
    });

    it("shows the declared objective, areas of interest and availability", async () => {
      await renderTable();

      expect(row("Objetivo declarado")[0].textContent).toBe("Atuar com front-end.");
      expect(row("Áreas de interesse")[0].textContent).toBe("Desenvolvimento front-end");
      expect(row("Tipos de vaga")[0].textContent).toBe("Estágio");
      expect(row("Modalidades")[0].textContent).toBe("Remoto");
      expect(row("Início")[0].textContent).toBe("Imediato");
      expect(row("Carga horária")[0].textContent).toBe("Até 30 horas por semana");
      expect(row("Mobilidade")[0].textContent).toBe("Aceita viajar a trabalho");
    });

    it("shows a start date when the student is not available immediately", async () => {
      await renderTable(profileA({ busca: makeTalentBusca({ disponivelAPartirDe: "2999-01-15" }) }));

      expect(row("Início")[0].textContent).toBe("A partir de 15/01/2999");
    });

    it("shows professional links and the protected resume", async () => {
      await renderTable();

      expect(within(row("LinkedIn")[0]).getByRole("link", { name: "LinkedIn" }).getAttribute("href")).toBe("https://linkedin.com/in/maria");
      expect(within(row("GitHub")[0]).getByRole("link", { name: "GitHub" }).getAttribute("href")).toBe("https://github.com/maria");
      expect(within(row("Portfólio")[0]).getByRole("link", { name: "Portfólio" }).getAttribute("href")).toBe("https://maria.dev");
      expect(within(row("Currículo em PDF")[0]).getByRole("button", { name: "Abrir currículo" })).toBeTruthy();
    });

    it("opens the resume and the certificate only through the protected download", async () => {
      downloadMock.mockResolvedValue(new Blob(["pdf"]));
      vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:test"), revokeObjectURL: vi.fn() }));
      const user = userEvent.setup();
      await renderTable();

      await user.click(within(row("Currículo em PDF")[0]).getByRole("button", { name: "Abrir currículo" }));
      await user.click(within(row("Outras formações e cursos")[0]).getByRole("button", { name: "Abrir certificado" }));

      expect(downloadMock).toHaveBeenCalledWith("/api/talentos/ana-lima/curriculo");
      expect(downloadMock).toHaveBeenCalledWith("/api/talentos/ana-lima/formacoes/f-2/certificado");
    });

    it("shows a file error when a protected download fails", async () => {
      downloadMock.mockRejectedValue(new ApiError(SERVER_ERROR, "Arquivo indisponível"));
      const user = userEvent.setup();
      await renderTable();

      await user.click(within(row("Currículo em PDF")[0]).getByRole("button", { name: "Abrir currículo" }));

      expect((await screen.findByRole("alert")).textContent).toContain("Arquivo indisponível");
    });
  });

  describe("missing data", () => {
    it("shows the same discreet placeholder for every empty field and list", async () => {
      await renderTable(profileA({ formacoes: [], experiencias: [], projetos: [], competencias: [], idiomas: [], busca: makeTalentBusca(), disponibilidades: [], modalidades: [], contato: { telefone: null, emailProfissional: null, linkedInUrl: null, gitHubUrl: null, portfolioUrl: null }, curriculo: { possuiCurriculo: false, url: null } }));

      for (const label of [
        "Formação principal", "Outras formações e cursos", "Experiências profissionais", "Competências técnicas", "Competências comportamentais",
        "Idiomas e nível", "Projetos em destaque", "Objetivo declarado", "Áreas de interesse", "Tipos de vaga", "Modalidades", "Início",
        "Carga horária", "Mobilidade", "LinkedIn", "GitHub", "Portfólio", "Currículo em PDF",
      ]) {
        const [a, b] = row(label);
        expect(a.textContent, `${label} (A)`).toBe(MISSING);
        expect(b.textContent, `${label} (B)`).toBe(MISSING);
      }
    });

    it("says the certificate is available when there is no download path", async () => {
      await renderTable(profileA({ formacoes: [makeFormation({ possuiCertificado: true, certificadoUrl: null })], curriculo: { possuiCurriculo: true, url: null } }));

      expect(within(row("Formação principal")[0]).getByText("Certificado disponível")).toBeTruthy();
      expect(within(row("Formação principal")[0]).queryByRole("button")).toBeNull();
      expect(row("Currículo em PDF")[0].textContent).toBe("Disponível");
    });

    it("keeps long texts fully readable without truncating them", async () => {
      const long = "Texto muito longo ".repeat(80).trim();
      await renderTable(profileA({ busca: makeTalentBusca({ objetivo: long }) }));

      expect(row("Objetivo declarado")[0].textContent).toBe(long);
    });
  });

  describe("privacy and safety", () => {
    it("never shows the e-mail or the phone", async () => {
      await renderTable();

      expect(screen.queryByText(/maria@example\.com/)).toBeNull();
      expect(screen.queryByText(/32999998888/)).toBeNull();
      expect(screen.queryByRole("rowheader", { name: /e-?mail|telefone|contato/i })).toBeNull();
      expect(document.querySelector('a[href^="mailto:"], a[href^="tel:"]')).toBeNull();
    });

    it("never shows PCD data, even when the student shared it", async () => {
      await renderTable(profileA({ busca: makeTalentBusca({ pcd: { souPcd: true, interesseVagaPcd: true, tipos: ["VISUAL"] } }) }));

      expect(screen.queryByText(/pcd/i)).toBeNull();
      expect(screen.queryByText(/visual/i)).toBeNull();
    });

    it("shows unsafe URLs as plain text instead of links", async () => {
      await renderTable(profileA({
        contato: { telefone: null, emailProfissional: null, linkedInUrl: UNSAFE_URL, gitHubUrl: "ftp://example.com/x", portfolioUrl: "https://maria.dev" },
        projetos: [{ id: "p-1", ordem: 1, nome: "Projeto", dataInicio: "2025-02-01", dataFim: "2025-03-01", emAndamento: false, descricao: "Desc", demoUrl: UNSAFE_URL, repositorioUrl: null, tecnologias: [] }],
      }));

      expect(within(row("LinkedIn")[0]).getByText(UNSAFE_URL)).toBeTruthy();
      expect(within(row("LinkedIn")[0]).queryByRole("link")).toBeNull();
      expect(within(row("GitHub")[0]).queryByRole("link")).toBeNull();
      expect(within(row("Projetos em destaque")[0]).queryByRole("link")).toBeNull();
      expect(within(row("Portfólio")[0]).getByRole("link", { name: "Portfólio" })).toBeTruthy();
    });

    it("does not apply any ranking, score or winner highlight", async () => {
      await renderTable();

      expect(screen.queryByText(/melhor|pior|vencedor|pontua|ranking:|score/i)).toBeNull();
    });
  });

  describe("narrow screens", () => {
    it("scrolls the table sideways and keeps a minimum width instead of squeezing the columns", async () => {
      await renderTable();

      const table = screen.getByRole("table", { name: "Tabela de currículos" });
      expect(getComputedStyle(table.parentElement as HTMLElement).overflowX).toBe("auto");
      expect(getComputedStyle(table).minWidth).toBe("760px");
      // The field names stay pinned while the candidate columns scroll.
      expect(getComputedStyle(screen.getByRole("rowheader", { name: "Cidade/UF" })).position).toBe("sticky");
    });
  });

  describe("view tabs", () => {
    it("marks the table view as current and keeps both slugs in the links", async () => {
      await renderTable();

      const current = screen.getByRole("tab", { name: "Comparação atual" });
      const table = screen.getByRole("tab", { name: "Tabela de currículos" });
      expect(current.getAttribute("href")).toBe(`/recrutador/comparar?slugs=${SLUG_A}&slugs=${SLUG_B}`);
      expect(table.getAttribute("href")).toBe(`/recrutador/comparar/tabela?slugs=${SLUG_A}&slugs=${SLUG_B}`);
      expect(table.getAttribute("aria-current")).toBe("page");
      expect(current.getAttribute("aria-current")).toBeNull();
    });
  });
});
