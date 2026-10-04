import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TalentProfileView } from "@/components/recruiter/TalentProfileView";
import { ApiError, apiDownload } from "@/lib/api";
import { addFavorite, fetchTalent, removeFavorite } from "@/lib/recruiter";
import type { TalentExperience, TalentProfile, TalentProject } from "@/types/recruiter";
import { makeFormation, makeTalentProfile } from "./recruiterFixtures";

vi.setConfig({ testTimeout: 15_000 });

vi.mock("@/hooks/useProtectedFile", () => ({
  useProtectedFile: () => ({ url: null, loading: false, error: null, reload: vi.fn() }),
}));
vi.mock("@/lib/recruiter", () => ({ fetchTalent: vi.fn(), addFavorite: vi.fn(), removeFavorite: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiDownload: vi.fn(),
}));

const fetchMock = vi.mocked(fetchTalent);
const addMock = vi.mocked(addFavorite);
const removeMock = vi.mocked(removeFavorite);
const downloadMock = vi.mocked(apiDownload);

const SLUG = "maria-souza";
const NAME = "Maria Souza";
const NOT_FOUND = 404;
const SERVER_ERROR = 500;
const UNAVAILABLE = "Este perfil não está mais disponível.";
const LOAD_FALLBACK = "Não foi possível carregar o perfil.";
const NO_INFO = "Nenhuma informação cadastrada.";
const UNSAFE_URL = "javascript:alert(1)";
const INVALID_EMAIL = "maria@";
const INVALID_PHONE = "123";

function makeExperience(overrides: Partial<TalentExperience> = {}): TalentExperience {
  return {
    id: "e-1",
    empresa: "Acme",
    cargo: "Desenvolvedora",
    tipo: "PROFISSIONAL",
    dataInicio: "2023-03-01",
    dataFim: "2024-01-15",
    atual: false,
    descricao: null,
    ...overrides,
  };
}

function makeProject(overrides: Partial<TalentProject> = {}): TalentProject {
  return {
    id: "p-1",
    ordem: 1,
    nome: "Talent Valley",
    dataInicio: "2024-05-10",
    dataFim: null,
    emAndamento: true,
    descricao: "Plataforma de talentos.",
    demoUrl: "https://demo.example.com",
    repositorioUrl: "https://github.com/maria/tv",
    tecnologias: [{ id: 2, nome: "TypeScript" }],
    ...overrides,
  };
}

async function renderProfile(overrides: Partial<TalentProfile> = {}) {
  fetchMock.mockResolvedValue(makeTalentProfile({ nomeCompleto: NAME, ...overrides }));
  render(<TalentProfileView slug={SLUG} />);
  await screen.findByRole("heading", { level: 1, name: NAME });
}

function section(title: string): HTMLElement {
  return screen.getByRole("heading", { level: 2, name: title }).closest("section") as HTMLElement;
}

const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const originalRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");

function restoreUrlMethod(name: "createObjectURL" | "revokeObjectURL", descriptor: PropertyDescriptor | undefined) {
  if (descriptor) Object.defineProperty(URL, name, descriptor);
  else Reflect.deleteProperty(URL, name);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
  restoreUrlMethod("createObjectURL", originalCreateObjectURL);
  restoreUrlMethod("revokeObjectURL", originalRevokeObjectURL);
});

describe("TalentProfileView", () => {
  it("shows skeletons while loading and requests the profile by slug", () => {
    fetchMock.mockReturnValue(new Promise<TalentProfile>(() => undefined));
    const { container } = render(<TalentProfileView slug={SLUG} />);

    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(4);
    expect(fetchMock).toHaveBeenCalledWith(SLUG);
  });

  it("renders the header with name, location and a way back to the talents list", async () => {
    await renderProfile();

    expect(screen.getByText("Rio Pomba / MG")).toBeTruthy();
    expect(screen.getByText(/^Atualizado em 01\/09\/2026/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Voltar para talentos" }).getAttribute("href")).toBe("/recrutador/talentos");
  });

  it("shows a placeholder location when the talent has none", async () => {
    await renderProfile({ cidade: null, uf: null });

    expect(screen.getByText("Localização não informada")).toBeTruthy();
  });

  it("renders bio, skills, languages, availability and modalities", async () => {
    await renderProfile({
      bio: "Linha 1\nLinha 2",
      competencias: [{ id: 1, nome: "React" }, { id: 2, nome: "SQL" }],
      idiomas: [{ idiomaId: 1, nome: "Inglês", nivel: "AVANCADO" }],
      disponibilidades: ["ESTAGIO", "CLT"],
      modalidades: ["REMOTO", "HIBRIDO"],
    });

    expect(within(section("Sobre")).getByText(/Linha 1/).textContent).toBe("Linha 1\nLinha 2");
    const skills = within(section("Competências gerais"));
    expect(skills.getByText("React")).toBeTruthy();
    expect(skills.getByText("SQL")).toBeTruthy();
    expect(within(section("Idiomas")).getByText("Inglês · Avançado")).toBeTruthy();
    const availability = within(section("Disponibilidade e modalidades"));
    expect(availability.getByText("Estágio")).toBeTruthy();
    expect(availability.getByText("CLT")).toBeTruthy();
    expect(availability.getByText("Remoto")).toBeTruthy();
    expect(availability.getByText("Híbrido")).toBeTruthy();
  });

  it("shows empty-state text for every empty section", async () => {
    await renderProfile({
      bio: null,
      competencias: [],
      idiomas: [],
      disponibilidades: [],
      modalidades: [],
      formacoes: [],
      experiencias: [],
      projetos: [],
      contato: { telefone: null, emailProfissional: null, linkedInUrl: null, gitHubUrl: null, portfolioUrl: null },
      curriculo: { possuiCurriculo: false, url: null },
    });

    expect(within(section("Sobre")).getByText("Este talento ainda não informou uma apresentação profissional.")).toBeTruthy();
    for (const title of ["Competências gerais", "Trajetória", "Projetos", "Idiomas"]) {
      expect(within(section(title)).getByText(NO_INFO)).toBeTruthy();
    }
    expect(within(section("Disponibilidade e modalidades")).getAllByText(NO_INFO)).toHaveLength(2);
    expect(within(section("Contato")).getByText("Contato profissional não informado.")).toBeTruthy();
    expect(within(section("Currículo")).getByText("Currículo não informado.")).toBeTruthy();
  });

  describe("trajectory", () => {
    it("merges formations and experiences, newest first", async () => {
      await renderProfile({
        formacoes: [makeFormation({ nome: "Formação Antiga", dataInicio: "2020-01-01" }), makeFormation({ id: "f-2", nome: "Formação Recente", dataInicio: "2024-08-01" })],
        experiencias: [makeExperience({ cargo: "Cargo Intermediário", dataInicio: "2022-06-01" })],
      });

      const text = section("Trajetória").textContent ?? "";
      const order = ["Formação Recente", "Cargo Intermediário", "Formação Antiga"].map((item) => text.indexOf(item));
      expect(order.every((position) => position >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });

    it("describes a formation with labels, period and badges", async () => {
      await renderProfile({
        formacoes: [makeFormation({ status: "CONCLUIDO", dataInicio: "2018-02-01", dataFim: "2021-12-15", cargaHoraria: 120, rpvVerificado: true })],
      });

      const trajectory = within(section("Trajetória"));
      expect(trajectory.getByText("Sistemas de Informação")).toBeTruthy();
      expect(trajectory.getByText("IF Sudeste MG · Graduação · Concluído")).toBeTruthy();
      expect(trajectory.getByText("01/02/2018 — 15/12/2021")).toBeTruthy();
      expect(trajectory.getByText("120 horas")).toBeTruthy();
      expect(trajectory.getByText("Verificado pelo Rio Pomba Valley")).toBeTruthy();
    });

    it("marks an in-progress formation as current", async () => {
      await renderProfile({ formacoes: [makeFormation({ status: "EM_ANDAMENTO", dataInicio: "2022-02-01", dataFim: null })] });

      expect(within(section("Trajetória")).getByText("01/02/2022 — Atual")).toBeTruthy();
    });

    it("says the end date is unknown for a stopped formation without end date", async () => {
      await renderProfile({ formacoes: [makeFormation({ status: "TRANCADO", dataFim: null })] });

      expect(within(section("Trajetória")).getByText("01/02/2022 — Não informado")).toBeTruthy();
    });

    it("hides optional formation badges and the certificate when absent", async () => {
      await renderProfile({ formacoes: [makeFormation({ possuiCertificado: true, certificadoUrl: null })] });

      const trajectory = within(section("Trajetória"));
      expect(trajectory.queryByText(/horas/)).toBeNull();
      expect(trajectory.queryByText("Verificado pelo Rio Pomba Valley")).toBeNull();
      expect(trajectory.queryByRole("button")).toBeNull();
    });

    it("describes an experience with its description and current period", async () => {
      await renderProfile({
        experiencias: [makeExperience({ tipo: "ESTAGIO", atual: true, dataFim: null, descricao: "Trabalho com APIs." })],
      });

      const trajectory = within(section("Trajetória"));
      expect(trajectory.getByText("Desenvolvedora")).toBeTruthy();
      expect(trajectory.getByText("Acme · Estágio")).toBeTruthy();
      expect(trajectory.getByText("01/03/2023 — Atual")).toBeTruthy();
      expect(trajectory.getByText("Trabalho com APIs.")).toBeTruthy();
    });

    it("omits the description of an experience that has none and shows its end date", async () => {
      await renderProfile({ experiencias: [makeExperience({ descricao: null })] });

      const trajectory = within(section("Trajetória"));
      expect(trajectory.getByText("01/03/2023 — 15/01/2024")).toBeTruthy();
      expect(trajectory.getByText("Acme · Profissional")).toBeTruthy();
    });

    it("opens a formation certificate through the protected download", async () => {
      downloadMock.mockResolvedValue(new Blob(["pdf"]));
      const createObjectURL = vi.fn(() => "blob:cert");
      Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true });
      Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true, writable: true });
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
      const user = userEvent.setup();
      await renderProfile({
        formacoes: [makeFormation({ nome: "Curso X", possuiCertificado: true, certificadoUrl: "/api/certificados/f-1" })],
      });

      await user.click(screen.getByRole("button", { name: "Abrir certificado de Curso X" }));

      await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
      expect(downloadMock).toHaveBeenCalledWith("/api/certificados/f-1");
    });
  });

  describe("projects", () => {
    it("lists projects with period, technologies and safe external links", async () => {
      await renderProfile({ projetos: [makeProject()] });

      const projects = within(section("Projetos"));
      expect(projects.getByText("Talent Valley")).toBeTruthy();
      expect(projects.getByText("10/05/2024 — Atual")).toBeTruthy();
      expect(projects.getByText("Plataforma de talentos.")).toBeTruthy();
      expect(projects.getByText("TypeScript")).toBeTruthy();
      const demo = projects.getByRole("link", { name: "Ver demonstração" });
      expect(demo.getAttribute("href")).toBe("https://demo.example.com");
      expect(demo.getAttribute("target")).toBe("_blank");
      expect(demo.getAttribute("rel")).toBe("noreferrer");
      expect(projects.getByRole("link", { name: "Ver repositório" }).getAttribute("href")).toBe("https://github.com/maria/tv");
    });

    it("omits links that are missing", async () => {
      await renderProfile({ projetos: [makeProject({ demoUrl: null, repositorioUrl: null, emAndamento: false, dataFim: "2024-06-30" })] });

      const projects = within(section("Projetos"));
      expect(projects.queryByRole("link")).toBeNull();
      expect(projects.getByText("10/05/2024 — 30/06/2024")).toBeTruthy();
    });

    it("renders unsafe project URLs as plain text instead of links", async () => {
      await renderProfile({ projetos: [makeProject({ demoUrl: UNSAFE_URL, repositorioUrl: null })] });

      const projects = within(section("Projetos"));
      expect(projects.queryByRole("link")).toBeNull();
      expect(projects.getByText(UNSAFE_URL)).toBeTruthy();
    });
  });

  describe("contact", () => {
    it("renders valid contact channels as links", async () => {
      await renderProfile({
        contato: {
          telefone: "+55 (32) 99999-8888",
          emailProfissional: "maria@example.com",
          linkedInUrl: "https://linkedin.com/in/maria",
          gitHubUrl: "https://github.com/maria",
          portfolioUrl: "https://maria.dev",
        },
      });

      const contact = within(section("Contato"));
      expect(contact.getByRole("link", { name: "maria@example.com" }).getAttribute("href")).toBe("mailto:maria@example.com");
      expect(contact.getByRole("link", { name: "+55 (32) 99999-8888" }).getAttribute("href")).toBe("tel:32999998888");
      expect(contact.getByRole("link", { name: "LinkedIn" }).getAttribute("href")).toBe("https://linkedin.com/in/maria");
      expect(contact.getByRole("link", { name: "GitHub" }).getAttribute("href")).toBe("https://github.com/maria");
      expect(contact.getByRole("link", { name: "Portfólio" }).getAttribute("href")).toBe("https://maria.dev");
    });

    it("shows the header shortcuts for email and LinkedIn", async () => {
      await renderProfile();

      const header = within(screen.getByRole("banner"));
      expect(header.getByRole("link", { name: "E-mail" }).getAttribute("href")).toBe("mailto:maria@example.com");
      expect(header.getByRole("link", { name: "LinkedIn" }).getAttribute("href")).toBe("https://linkedin.com/in/maria");
    });

    it("keeps malformed or unsafe values as plain text, never as links", async () => {
      await renderProfile({
        contato: {
          telefone: INVALID_PHONE,
          emailProfissional: INVALID_EMAIL,
          linkedInUrl: UNSAFE_URL,
          gitHubUrl: null,
          portfolioUrl: null,
        },
      });

      const contact = within(section("Contato"));
      expect(contact.queryByRole("link")).toBeNull();
      expect(contact.getByText(INVALID_EMAIL)).toBeTruthy();
      expect(contact.getByText(INVALID_PHONE)).toBeTruthy();
      expect(contact.getByText(UNSAFE_URL)).toBeTruthy();
      expect(within(screen.getByRole("banner")).queryByRole("link", { name: "E-mail" })).toBeNull();
    });

    it("hides header shortcuts for channels that were not informed", async () => {
      await renderProfile({
        contato: { telefone: null, emailProfissional: null, linkedInUrl: null, gitHubUrl: "https://github.com/maria", portfolioUrl: null },
      });

      const header = within(screen.getByRole("banner"));
      expect(header.queryByRole("link", { name: "E-mail" })).toBeNull();
      expect(header.queryByRole("link", { name: "LinkedIn" })).toBeNull();
    });
  });

  describe("resume", () => {
    it("offers the resume in the header and in its own section when available", async () => {
      await renderProfile({ curriculo: { possuiCurriculo: true, url: "/api/curriculo/maria" } });

      expect(within(screen.getByRole("banner")).getByRole("button", { name: "Abrir CV" })).toBeTruthy();
      expect(within(section("Currículo")).getByRole("button", { name: `Abrir currículo de ${NAME}` })).toBeTruthy();
    });

    it("does not offer the resume when it has no URL", async () => {
      await renderProfile({ curriculo: { possuiCurriculo: true, url: null } });

      expect(screen.queryByRole("button", { name: "Abrir CV" })).toBeNull();
      expect(within(section("Currículo")).getByText("Currículo não informado.")).toBeTruthy();
    });

    it("shows a dismissible error when the file cannot be opened", async () => {
      downloadMock.mockRejectedValue(new ApiError(SERVER_ERROR, "Arquivo indisponível"));
      const user = userEvent.setup();
      await renderProfile({ curriculo: { possuiCurriculo: true, url: "/api/curriculo/maria" } });

      await user.click(screen.getByRole("button", { name: "Abrir CV" }));

      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toContain("Arquivo indisponível");
      await user.click(within(alert).getByRole("button", { name: /close|fechar/i }));
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("favorite", () => {
    it("toggles the favorite state of the displayed profile", async () => {
      addMock.mockResolvedValue(undefined);
      removeMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      await renderProfile({ favorito: false });

      await user.click(screen.getByRole("button", { name: `Adicionar aos favoritos: ${NAME}` }));
      await user.click(await screen.findByRole("button", { name: `Remover dos favoritos: ${NAME}` }));

      expect(await screen.findByRole("button", { name: `Adicionar aos favoritos: ${NAME}` })).toBeTruthy();
      expect(addMock).toHaveBeenCalledWith(SLUG);
      expect(removeMock).toHaveBeenCalledWith(SLUG);
    });

    it("shows the unavailable page when the favorite request finds no profile", async () => {
      addMock.mockRejectedValue(new ApiError(NOT_FOUND, "Not found"));
      const user = userEvent.setup();
      await renderProfile({ favorito: false });

      await user.click(screen.getByRole("button", { name: `Adicionar aos favoritos: ${NAME}` }));

      expect(await screen.findByText(UNAVAILABLE)).toBeTruthy();
      expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    });
  });

  describe("loading failures", () => {
    it("shows the unavailable page with a way back on 404", async () => {
      fetchMock.mockRejectedValue(new ApiError(NOT_FOUND, "Not found"));
      render(<TalentProfileView slug={SLUG} />);

      expect(await screen.findByText(UNAVAILABLE)).toBeTruthy();
      expect(screen.getByRole("link", { name: "Voltar para talentos" }).getAttribute("href")).toBe("/recrutador/talentos");
    });

    it("shows the API error and retries successfully", async () => {
      fetchMock.mockRejectedValueOnce(new ApiError(SERVER_ERROR, "Falha no servidor")).mockResolvedValueOnce(makeTalentProfile({ nomeCompleto: NAME }));
      const user = userEvent.setup();
      render(<TalentProfileView slug={SLUG} />);

      expect((await screen.findByRole("alert")).textContent).toContain("Falha no servidor");
      await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

      expect(await screen.findByRole("heading", { level: 1, name: NAME })).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("retries after an unknown failure once the profile loads", async () => {
      fetchMock.mockRejectedValueOnce("boom").mockResolvedValueOnce(makeTalentProfile({ nomeCompleto: NAME }));
      const user = userEvent.setup();
      render(<TalentProfileView slug={SLUG} />);
      await screen.findByRole("alert");

      await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

      expect(await screen.findByRole("heading", { level: 1, name: NAME })).toBeTruthy();
    });

    it("falls back to the generic message for unknown failures", async () => {
      fetchMock.mockRejectedValue("boom");
      render(<TalentProfileView slug={SLUG} />);

      expect((await screen.findByRole("alert")).textContent).toContain(LOAD_FALLBACK);
    });

    it("ignores the response of a request that was superseded by a new slug", async () => {
      let resolveFirst: (profile: TalentProfile) => void = () => undefined;
      fetchMock
        .mockReturnValueOnce(new Promise<TalentProfile>((resolve) => { resolveFirst = resolve; }))
        .mockResolvedValueOnce(makeTalentProfile({ slug: "joao", nomeCompleto: "João Lima" }));
      const { rerender } = render(<TalentProfileView slug={SLUG} />);

      rerender(<TalentProfileView slug="joao" />);
      await screen.findByRole("heading", { level: 1, name: "João Lima" });
      resolveFirst(makeTalentProfile({ nomeCompleto: NAME }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(screen.queryByRole("heading", { level: 1, name: NAME })).toBeNull();
    });

    it("ignores a failure of a request that was superseded by a new slug", async () => {
      let rejectFirst: (reason: unknown) => void = () => undefined;
      fetchMock
        .mockReturnValueOnce(new Promise<TalentProfile>((_, reject) => { rejectFirst = reject; }))
        .mockResolvedValueOnce(makeTalentProfile({ slug: "joao", nomeCompleto: "João Lima" }));
      const { rerender } = render(<TalentProfileView slug={SLUG} />);

      rerender(<TalentProfileView slug="joao" />);
      await screen.findByRole("heading", { level: 1, name: "João Lima" });
      rejectFirst(new ApiError(NOT_FOUND, "Not found"));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      expect(screen.queryByText(UNAVAILABLE)).toBeNull();
    });
  });
});
