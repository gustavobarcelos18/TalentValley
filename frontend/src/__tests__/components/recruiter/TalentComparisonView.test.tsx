import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TalentComparisonView } from "@/components/recruiter/TalentComparisonView";
import { ApiError, apiDownload } from "@/lib/api";
import { fetchTalentComparison } from "@/lib/recruiter";
import type { TalentComparison } from "@/types/recruiter";
import { makeTalentProfile } from "./recruiterFixtures";

vi.setConfig({ testTimeout: 15_000 });

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }));
vi.mock("@/hooks/useProtectedFile", () => ({
  useProtectedFile: () => ({ url: null, loading: false, error: null, reload: vi.fn() }),
}));
vi.mock("@/lib/recruiter", () => ({ fetchTalentComparison: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiDownload: vi.fn(),
}));

const fetchMock = vi.mocked(fetchTalentComparison);
const downloadMock = vi.mocked(apiDownload);

const SLUG_A = "ana-lima";
const SLUG_B = "bruno-reis";
const NOT_FOUND = 404;
const SERVER_ERROR = 500;
const SELECT_TWO = "Selecione exatamente dois talentos para comparar.";
const NO_COMMON = "Nenhum item em comum.";
const NO_INFO = "Nenhuma informação cadastrada.";
const LOAD_FALLBACK = "Não foi possível carregar a comparação.";
const UNSAFE_URL = "javascript:alert(1)";

const REACT = { id: 1, nome: "React" };
const VUE = { id: 2, nome: "Vue" };
const ANGULAR = { id: 3, nome: "Angular" };

function makeComparison(overrides: Partial<TalentComparison> = {}): TalentComparison {
  return {
    talentoA: makeTalentProfile({ slug: SLUG_A, nomeCompleto: "Ana Lima", competencias: [REACT, VUE] }),
    emComum: { competencias: [REACT], disponibilidades: ["ESTAGIO"], modalidades: ["REMOTO"] },
    talentoB: makeTalentProfile({ id: "talento-2", slug: SLUG_B, nomeCompleto: "Bruno Reis", competencias: [REACT, ANGULAR] }),
    ...overrides,
  };
}

function setSlugs(...slugs: string[]) {
  const params = new URLSearchParams();
  for (const slug of slugs) params.append("slugs", slug);
  nav.params = params;
}

async function renderComparison(comparison: TalentComparison = makeComparison()) {
  setSlugs(SLUG_A, SLUG_B);
  fetchMock.mockResolvedValue(comparison);
  render(<TalentComparisonView />);
  await screen.findByRole("heading", { level: 1, name: "Comparar talentos" });
}

function side(index: 0 | 1): ReturnType<typeof within> {
  return within(screen.getAllByRole("article")[index]);
}

function sectionOf(scope: ReturnType<typeof within>, title: string): ReturnType<typeof within> {
  return within(scope.getByText(title).closest("section") as HTMLElement);
}

afterEach(() => {
  vi.resetAllMocks();
  nav.params = new URLSearchParams();
});

describe("TalentComparisonView", () => {
  describe("invalid selection", () => {
    it.each([
      { description: "no slugs", slugs: [] as string[] },
      { description: "a single slug", slugs: [SLUG_A] },
      { description: "three slugs", slugs: [SLUG_A, SLUG_B, "carla"] },
      { description: "identical slugs", slugs: [SLUG_A, SLUG_A] },
      { description: "a blank first slug", slugs: ["   ", SLUG_B] },
      { description: "a blank second slug", slugs: [SLUG_A, ""] },
    ])("asks for exactly two talents with $description and does not fetch", ({ slugs }) => {
      setSlugs(...slugs);
      render(<TalentComparisonView />);

      expect(screen.getByText(SELECT_TWO)).toBeTruthy();
      expect(screen.getByRole("link", { name: "Explorar talentos" }).getAttribute("href")).toBe("/recrutador/talentos");
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("loading", () => {
    it("shows skeletons while the comparison is loading", () => {
      setSlugs(SLUG_A, SLUG_B);
      fetchMock.mockReturnValue(new Promise<TalentComparison>(() => undefined));
      const { container } = render(<TalentComparisonView />);

      expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(3);
      expect(fetchMock).toHaveBeenCalledWith([SLUG_A, SLUG_B]);
    });

    it("shows a dedicated message when one of the profiles is gone (404)", async () => {
      setSlugs(SLUG_A, SLUG_B);
      fetchMock.mockRejectedValue(new ApiError(NOT_FOUND, "Not found"));
      render(<TalentComparisonView />);

      expect((await screen.findByRole("alert")).textContent).toContain("Um dos perfis não está mais disponível.");
    });

    it("shows the API error message and retries successfully", async () => {
      setSlugs(SLUG_A, SLUG_B);
      fetchMock.mockRejectedValueOnce(new ApiError(SERVER_ERROR, "Falha no servidor")).mockResolvedValueOnce(makeComparison());
      const user = userEvent.setup();
      render(<TalentComparisonView />);

      expect((await screen.findByRole("alert")).textContent).toContain("Falha no servidor");
      await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

      expect(await screen.findByRole("heading", { level: 1, name: "Comparar talentos" })).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("falls back to the generic message for unknown failures", async () => {
      setSlugs(SLUG_A, SLUG_B);
      fetchMock.mockRejectedValue("boom");
      render(<TalentComparisonView />);

      expect((await screen.findByRole("alert")).textContent).toContain(LOAD_FALLBACK);
    });

    it("ignores the outcome of a request superseded by different slugs", async () => {
      setSlugs(SLUG_A, SLUG_B);
      let resolveFirst: (comparison: TalentComparison) => void = () => undefined;
      let rejectSecond: (reason: unknown) => void = () => undefined;
      fetchMock
        .mockReturnValueOnce(new Promise<TalentComparison>((resolve) => { resolveFirst = resolve; }))
        .mockReturnValueOnce(new Promise<TalentComparison>((_, reject) => { rejectSecond = reject; }))
        .mockResolvedValueOnce(makeComparison({ talentoA: makeTalentProfile({ slug: "carla", nomeCompleto: "Carla Dias" }) }));
      const { rerender } = render(<TalentComparisonView />);

      setSlugs(SLUG_A, "carla");
      rerender(<TalentComparisonView />);
      setSlugs(SLUG_A, "diego");
      rerender(<TalentComparisonView />);
      await screen.findByText("Carla Dias");
      resolveFirst(makeComparison());
      rejectSecond(new ApiError(NOT_FOUND, "Not found"));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByText("Ana Lima")).toBeNull();
    });
  });

  describe("comparison", () => {
    it("renders both talents side by side with the shared section in between", async () => {
      await renderComparison();

      expect(screen.getByRole("link", { name: "Voltar para talentos" }).getAttribute("href")).toBe("/recrutador/talentos");
      const articles = screen.getAllByRole("article");
      expect(articles).toHaveLength(2);
      expect(within(articles[0]).getByRole("heading", { name: "Ana Lima" })).toBeTruthy();
      expect(within(articles[1]).getByRole("heading", { name: "Bruno Reis" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Em comum" })).toBeTruthy();
    });

    it("shows location, bio and placeholders when they are missing", async () => {
      await renderComparison(
        makeComparison({
          talentoA: makeTalentProfile({ nomeCompleto: "Ana Lima", cidade: "Rio Pomba", uf: "MG", bio: "Bio da Ana." }),
          talentoB: makeTalentProfile({ nomeCompleto: "Bruno Reis", cidade: null, uf: null, bio: null }),
        }),
      );

      expect(side(0).getByText("Rio Pomba / MG")).toBeTruthy();
      expect(side(0).getByText("Bio da Ana.")).toBeTruthy();
      expect(side(1).getByText("Localização não informada")).toBeTruthy();
      expect(side(1).getByText("Apresentação profissional não informada.")).toBeTruthy();
    });

    it("shows only the competencies not shared with the other talent, matched by id", async () => {
      await renderComparison(
        makeComparison({
          talentoA: makeTalentProfile({ nomeCompleto: "Ana Lima", competencias: [REACT, VUE] }),
          // Same display name as a common competency but a different id: it is exclusive.
          talentoB: makeTalentProfile({ nomeCompleto: "Bruno Reis", competencias: [REACT, { id: 99, nome: "React" }, ANGULAR] }),
        }),
      );

      const exclusiveA = sectionOf(side(0), "Competências exclusivas");
      expect(exclusiveA.getByText("Vue")).toBeTruthy();
      expect(exclusiveA.queryByText("React")).toBeNull();
      const exclusiveB = sectionOf(side(1), "Competências exclusivas");
      expect(exclusiveB.getByText("Angular")).toBeTruthy();
      expect(exclusiveB.getAllByText("React")).toHaveLength(1);
    });

    it("shows the common items and the empty message when nothing is shared", async () => {
      await renderComparison();

      const common = within(screen.getByRole("heading", { name: "Em comum" }).closest("section") as HTMLElement);
      expect(sectionOf(common, "Competências gerais").getByText("React")).toBeTruthy();
      expect(sectionOf(common, "Disponibilidade").getByText("Estágio")).toBeTruthy();
      expect(sectionOf(common, "Modalidades").getByText("Remoto")).toBeTruthy();
    });

    it("shows the empty message for each empty common category", async () => {
      await renderComparison(makeComparison({ emComum: { competencias: [], disponibilidades: [], modalidades: [] } }));

      const common = within(screen.getByRole("heading", { name: "Em comum" }).closest("section") as HTMLElement);
      expect(common.getAllByText(NO_COMMON)).toHaveLength(3);
    });

    it("lists languages, availability and modalities of each talent", async () => {
      await renderComparison(
        makeComparison({
          talentoA: makeTalentProfile({
            nomeCompleto: "Ana Lima",
            idiomas: [{ idiomaId: 1, nome: "Inglês", nivel: "FLUENTE" }],
            disponibilidades: ["CLT", "PJ"],
            modalidades: ["PRESENCIAL"],
          }),
          talentoB: makeTalentProfile({ nomeCompleto: "Bruno Reis", idiomas: [], disponibilidades: [], modalidades: [] }),
        }),
      );

      expect(sectionOf(side(0), "Idiomas").getByText("Inglês · Fluente")).toBeTruthy();
      expect(sectionOf(side(0), "Disponibilidade").getByText("CLT")).toBeTruthy();
      expect(sectionOf(side(0), "Disponibilidade").getByText("PJ")).toBeTruthy();
      expect(sectionOf(side(0), "Modalidades").getByText("Presencial")).toBeTruthy();
      for (const title of ["Idiomas", "Disponibilidade", "Modalidades"]) {
        expect(sectionOf(side(1), title).getByText(NO_INFO)).toBeTruthy();
      }
    });

    it("summarizes formations, experiences and projects", async () => {
      await renderComparison(
        makeComparison({
          talentoA: makeTalentProfile({
            nomeCompleto: "Ana Lima",
            formacoes: [
              {
                id: "f-1", tipo: "TECNOLOGO", nome: "Análise de Sistemas", instituicao: "IF Sudeste MG", dataInicio: "2022-02-01", dataFim: null,
                cargaHoraria: null, status: "EM_ANDAMENTO", principal: true, rpvVerificado: false, possuiCertificado: false, certificadoUrl: null,
              },
            ],
            experiencias: [
              { id: "e-1", empresa: "Acme", cargo: "Desenvolvedora", tipo: "PROFISSIONAL", dataInicio: "2023-03-01", dataFim: null, atual: true, descricao: "Trabalho com APIs." },
              { id: "e-2", empresa: "Beta", cargo: "Estagiária", tipo: "ESTAGIO", dataInicio: "2021-03-01", dataFim: "2022-03-01", atual: false, descricao: null },
            ],
            projetos: [
              {
                id: "p-1", ordem: 1, nome: "Talent Valley", dataInicio: "2024-05-10", dataFim: null, emAndamento: true, descricao: "Plataforma de talentos.",
                demoUrl: "https://demo.example.com", repositorioUrl: "https://github.com/ana/tv", tecnologias: [],
              },
              {
                id: "p-2", ordem: 2, nome: "Sem links", dataInicio: "2024-05-10", dataFim: null, emAndamento: true, descricao: "Sem links externos.",
                demoUrl: null, repositorioUrl: null, tecnologias: [],
              },
            ],
          }),
        }),
      );

      const trajectory = sectionOf(side(0), "Trajetória");
      expect(trajectory.getByText("Análise de Sistemas")).toBeTruthy();
      expect(trajectory.getByText("IF Sudeste MG · Tecnólogo")).toBeTruthy();
      expect(trajectory.getByText("Desenvolvedora")).toBeTruthy();
      expect(trajectory.getByText("Trabalho com APIs.")).toBeTruthy();
      expect(trajectory.getByText("Estagiária")).toBeTruthy();
      expect(trajectory.getByText("Beta")).toBeTruthy();
      const projects = sectionOf(side(0), "Projetos");
      expect(projects.getByText("Talent Valley")).toBeTruthy();
      expect(projects.getByText("Plataforma de talentos.")).toBeTruthy();
      expect(projects.getAllByRole("link")).toHaveLength(2);
      expect(projects.getByRole("link", { name: "Demonstração" }).getAttribute("href")).toBe("https://demo.example.com");
      expect(projects.getByRole("link", { name: "Repositório" }).getAttribute("href")).toBe("https://github.com/ana/tv");
      expect(sectionOf(side(1), "Trajetória").getByText(NO_INFO)).toBeTruthy();
      expect(sectionOf(side(1), "Projetos").getByText(NO_INFO)).toBeTruthy();
    });

    it("renders unsafe project URLs as plain text", async () => {
      await renderComparison(
        makeComparison({
          talentoA: makeTalentProfile({
            nomeCompleto: "Ana Lima",
            projetos: [
              {
                id: "p-1", ordem: 1, nome: "Projeto", dataInicio: "2024-05-10", dataFim: null, emAndamento: true, descricao: "Descrição.",
                demoUrl: UNSAFE_URL, repositorioUrl: null, tecnologias: [],
              },
            ],
          }),
        }),
      );

      const projects = sectionOf(side(0), "Projetos");
      expect(projects.queryByRole("link")).toBeNull();
      expect(projects.getByText(UNSAFE_URL)).toBeTruthy();
    });

    it("renders valid contact channels as links", async () => {
      await renderComparison(
        makeComparison({
          talentoA: makeTalentProfile({
            nomeCompleto: "Ana Lima",
            contato: {
              telefone: "+55 (32) 99999-8888",
              emailProfissional: "ana@example.com",
              linkedInUrl: "https://linkedin.com/in/ana",
              gitHubUrl: "https://github.com/ana",
              portfolioUrl: "https://ana.dev",
            },
          }),
        }),
      );

      const contact = sectionOf(side(0), "Contato");
      expect(contact.getByRole("link", { name: "E-mail" }).getAttribute("href")).toBe("mailto:ana@example.com");
      expect(contact.getByRole("link", { name: "Telefone" }).getAttribute("href")).toBe("tel:32999998888");
      expect(contact.getByRole("link", { name: "LinkedIn" }).getAttribute("href")).toBe("https://linkedin.com/in/ana");
      expect(contact.getByRole("link", { name: "GitHub" }).getAttribute("href")).toBe("https://github.com/ana");
      const portfolio = contact.getByRole("link", { name: "Portfólio" });
      expect(portfolio.getAttribute("href")).toBe("https://ana.dev");
      expect(portfolio.getAttribute("rel")).toBe("noreferrer");
    });

    it("keeps malformed contact values as plain text and omits missing ones", async () => {
      await renderComparison(
        makeComparison({
          talentoA: makeTalentProfile({
            nomeCompleto: "Ana Lima",
            contato: { telefone: "123", emailProfissional: "ana@", linkedInUrl: UNSAFE_URL, gitHubUrl: null, portfolioUrl: null },
          }),
          talentoB: makeTalentProfile({
            nomeCompleto: "Bruno Reis",
            contato: { telefone: null, emailProfissional: null, linkedInUrl: null, gitHubUrl: null, portfolioUrl: null },
          }),
        }),
      );

      const contactA = sectionOf(side(0), "Contato");
      expect(contactA.queryByRole("link")).toBeNull();
      expect(contactA.getByText("123")).toBeTruthy();
      expect(contactA.getByText("ana@")).toBeTruthy();
      expect(contactA.getByText(UNSAFE_URL)).toBeTruthy();
      expect(sectionOf(side(1), "Contato").queryByRole("link")).toBeNull();
    });

    it("shows a dismissible error when a protected file cannot be opened", async () => {
      downloadMock.mockRejectedValue(new ApiError(SERVER_ERROR, "Arquivo indisponível"));
      const user = userEvent.setup();
      await renderComparison(
        makeComparison({
          talentoA: makeTalentProfile({ nomeCompleto: "Ana Lima", curriculo: { possuiCurriculo: true, url: "/api/curriculo/ana" } }),
        }),
      );

      await user.click(sectionOf(side(0), "Contato").getByRole("button", { name: "Abrir currículo" }));

      const alert = await side(0).findByRole("alert");
      expect(alert.textContent).toContain("Arquivo indisponível");
      expect(downloadMock).toHaveBeenCalledWith("/api/curriculo/ana");
      expect(within(screen.getAllByRole("article")[1]).queryByRole("alert")).toBeNull();
      await user.click(within(alert).getByRole("button", { name: /close|fechar/i }));
      expect(side(0).queryByRole("alert")).toBeNull();
    });

    it("offers certificates only for formations that have a certificate file", async () => {
      const formation = {
        tipo: "CURSO_LIVRE" as const, instituicao: "Escola", dataInicio: "2022-02-01", dataFim: null, cargaHoraria: null,
        status: "CONCLUIDO" as const, principal: false, rpvVerificado: false,
      };
      await renderComparison(
        makeComparison({
          talentoA: makeTalentProfile({
            nomeCompleto: "Ana Lima",
            formacoes: [
              { ...formation, id: "f-1", nome: "Com certificado", possuiCertificado: true, certificadoUrl: "/api/certificados/f-1" },
              { ...formation, id: "f-2", nome: "Sem arquivo", possuiCertificado: true, certificadoUrl: null },
              { ...formation, id: "f-3", nome: "Sem certificado", possuiCertificado: false, certificadoUrl: "/api/certificados/f-3" },
            ],
          }),
        }),
      );

      expect(sectionOf(side(0), "Trajetória").getAllByRole("button", { name: "Abrir certificado" })).toHaveLength(1);
    });

    it("does not offer the resume without a file URL", async () => {
      await renderComparison(
        makeComparison({
          talentoA: makeTalentProfile({ nomeCompleto: "Ana Lima", curriculo: { possuiCurriculo: true, url: null } }),
        }),
      );

      expect(screen.queryByRole("button", { name: "Abrir currículo" })).toBeNull();
    });
  });
});

