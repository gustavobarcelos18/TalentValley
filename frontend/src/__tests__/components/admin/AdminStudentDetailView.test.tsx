import type { ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminStudentDetailView } from "@/components/admin/AdminViews";
import { adminApi } from "@/lib/admin";
import { ApiError } from "@/lib/api";
import type { AdminStudentDetail } from "@/types/admin";
import {
  makeAdminFormation,
  makeAdminStudentDetail,
  makeEmptyAdminStudentDetail,
} from "./adminDetailFixtures";
import { deferred } from "./adminFixtures";

vi.setConfig({ testTimeout: 15_000 });

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/recruiter/ProtectedTalentPhoto", () => ({
  ProtectedTalentPhoto: ({ path, name }: { path: string | null; name: string }) => (
    <div data-testid="photo" data-path={path ?? ""}>
      {name}
    </div>
  ),
}));
vi.mock("@/components/recruiter/ProtectedFileButton", () => ({
  ProtectedFileButton: ({ path, label }: { path: string; label: string }) => (
    <button type="button" data-path={path}>
      {label}
    </button>
  ),
}));
vi.mock("@/lib/admin", () => ({
  adminApi: { student: vi.fn(), validationAction: vi.fn() },
}));

const studentMock = vi.mocked(adminApi.student);
const validationActionMock = vi.mocked(adminApi.validationAction);

const SERVER_ERROR = 500;
const TIMESTAMP = "2026-09-01T12:00:00Z";
const LOAD_FALLBACK = "Não foi possível carregar os dados.";
const ACTION_FALLBACK = "Não foi possível concluir a ação.";
const REMOVE_TITLE = "Remover validação RPV?";
const REMOVE_NOTICE = "Validação RPV removida. A formação voltou para pendente.";

const VERIFIED_FORMATION = makeAdminFormation({
  id: "f-rpv",
  ehRioPombaValley: true,
  statusValidacaoRpv: "VERIFICADO",
});

function renderView(student: AdminStudentDetail = makeAdminStudentDetail()) {
  studentMock.mockResolvedValue(student);
  render(<AdminStudentDetailView id={student.id} />);
}

async function findProfile() {
  return screen.findByRole("heading", { level: 5, name: "Maria Souza" });
}

function section(title: string) {
  const heading = screen.getByRole("heading", { level: 2, name: title });
  return within(heading.closest("section") as HTMLElement);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("AdminStudentDetailView loading and errors", () => {
  it("shows skeletons while the student is loading", () => {
    studentMock.mockReturnValue(new Promise(() => undefined));
    const { container } = render(<AdminStudentDetailView id="aluno-1" />);

    expect(screen.getByRole("heading", { level: 1, name: "Perfil do aluno" })).toBeTruthy();
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(3);
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(studentMock).toHaveBeenCalledWith("aluno-1");
  });

  it("shows the API error message and retries", async () => {
    studentMock
      .mockRejectedValueOnce(new ApiError(SERVER_ERROR, "Falha no servidor"))
      .mockResolvedValueOnce(makeAdminStudentDetail());
    const user = userEvent.setup();
    render(<AdminStudentDetailView id="aluno-1" />);

    expect((await screen.findByRole("alert")).textContent).toContain("Falha no servidor");
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await findProfile()).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(studentMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback message for unknown loading failures", async () => {
    studentMock.mockRejectedValue("boom");
    render(<AdminStudentDetailView id="aluno-1" />);

    expect((await screen.findByRole("alert")).textContent).toContain(LOAD_FALLBACK);
  });
});

describe("AdminStudentDetailView profile", () => {
  it("renders the header with a back link, photo, location and active status", async () => {
    renderView(makeAdminStudentDetail({ fotoUrl: "/api/alunos/foto" }));
    await findProfile();

    expect(screen.getByRole("link", { name: "Voltar para alunos" }).getAttribute("href")).toBe("/admin/alunos");
    expect(screen.getByTestId("photo").getAttribute("data-path")).toBe("/api/alunos/foto");
    expect(screen.getByText("maria-souza · Rio Pomba / MG")).toBeTruthy();
    expect(screen.getByText("Ativo")).toBeTruthy();
    expect(section("Sobre").getByText("Estudante de sistemas de informação.")).toBeTruthy();
  });

  it("shows the blocked status and a partial location", async () => {
    renderView(makeAdminStudentDetail({ ativo: false, uf: null }));
    await findProfile();

    expect(screen.getByText("Bloqueado")).toBeTruthy();
    expect(screen.getByText("maria-souza · Rio Pomba")).toBeTruthy();
  });

  it("falls back to placeholders when the optional data is missing", async () => {
    renderView(makeEmptyAdminStudentDetail());
    await findProfile();

    expect(screen.getByText("maria-souza · Localização não informada")).toBeTruthy();
    expect(section("Sobre").getByText("Não informado.")).toBeTruthy();
    expect(section("Contato").getByText("Não informado.")).toBeTruthy();
    for (const title of ["Competências", "Formação", "Experiência", "Projetos"]) {
      expect(section(title).getByText("Nenhuma informação cadastrada.")).toBeTruthy();
    }
    expect(section("Currículo").getByText("Currículo não informado.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Abrir currículo" })).toBeNull();
    const emptyLanguages = screen.getByRole("heading", { level: 2, name: "Idiomas e disponibilidade" }).closest("section");
    expect(emptyLanguages?.textContent).toBe("Idiomas e disponibilidade");
  });

  it("lists skills, languages, availability and work modes", async () => {
    renderView(
      makeAdminStudentDetail({
        competencias: [
          { id: 1, nome: "React" },
          { id: 2, nome: "C#" },
        ],
        disponibilidades: ["ESTAGIO", "CLT"],
        modalidades: ["HIBRIDO"],
      }),
    );
    await findProfile();

    expect(section("Competências").getByText("React")).toBeTruthy();
    expect(section("Competências").getByText("C#")).toBeTruthy();
    const languages = section("Idiomas e disponibilidade");
    expect(languages.getByText("Inglês · Intermediário")).toBeTruthy();
    expect(languages.getByText("Estágio")).toBeTruthy();
    expect(languages.getByText("CLT")).toBeTruthy();
    expect(languages.getByText("Híbrido")).toBeTruthy();
  });

  it("lists experiences with and without a description", async () => {
    renderView(
      makeAdminStudentDetail({
        experiencias: [
          {
            id: "e-1",
            empresa: "Empresa X",
            cargo: "Desenvolvedora",
            tipo: "PROFISSIONAL",
            dataInicio: "2023-01-01",
            dataFim: null,
            atual: true,
            descricao: "Construiu APIs.",
            criadoEm: TIMESTAMP,
            atualizadoEm: TIMESTAMP,
          },
          {
            id: "e-2",
            empresa: "Empresa Y",
            cargo: "Estagiária",
            tipo: "ESTAGIO",
            dataInicio: "2022-01-01",
            dataFim: "2022-12-01",
            atual: false,
            descricao: null,
            criadoEm: TIMESTAMP,
            atualizadoEm: TIMESTAMP,
          },
        ],
      }),
    );
    await findProfile();

    const experience = section("Experiência");
    expect(experience.getByText("Desenvolvedora")).toBeTruthy();
    expect(experience.getByText("Empresa X · Profissional")).toBeTruthy();
    expect(experience.getByText("Construiu APIs.")).toBeTruthy();
    expect(experience.getByText("Estagiária")).toBeTruthy();
    expect(experience.getByText("Empresa Y · Estágio")).toBeTruthy();
  });

  it("lists projects with demo and repository links only when informed", async () => {
    renderView(
      makeAdminStudentDetail({
        projetos: [
          {
            id: "p-1",
            ordem: 1,
            nome: "Talent App",
            dataInicio: "2024-01-01",
            dataFim: null,
            emAndamento: true,
            descricao: "Plataforma de talentos.",
            demoUrl: "https://demo.example.com",
            repositorioUrl: "https://github.com/maria/talent",
            competencias: [],
            criadoEm: TIMESTAMP,
            atualizadoEm: TIMESTAMP,
          },
          {
            id: "p-2",
            ordem: 2,
            nome: "Projeto interno",
            dataInicio: "2024-01-01",
            dataFim: "2024-06-01",
            emAndamento: false,
            descricao: "Sem links.",
            demoUrl: null,
            repositorioUrl: null,
            competencias: [],
            criadoEm: TIMESTAMP,
            atualizadoEm: TIMESTAMP,
          },
        ],
      }),
    );
    await findProfile();

    const projects = section("Projetos");
    expect(projects.getByText("Talent App")).toBeTruthy();
    expect(projects.getByText("Plataforma de talentos.")).toBeTruthy();
    expect(projects.getByRole("link", { name: "https://demo.example.com" }).getAttribute("href")).toBe("https://demo.example.com");
    expect(projects.getByRole("link", { name: "https://github.com/maria/talent" }).getAttribute("href")).toBe("https://github.com/maria/talent");
    expect(projects.getByText("Projeto interno")).toBeTruthy();
    expect(projects.getAllByRole("link")).toHaveLength(2);
    expect(projects.getAllByText(/^(Demo|Repositório):/)).toHaveLength(2);
  });

  it("offers the protected resume only when it exists and has a URL", async () => {
    renderView(makeAdminStudentDetail({ curriculo: { possuiCurriculo: true, url: "/api/alunos/curriculo" } }));
    await findProfile();

    const button = section("Currículo").getByRole("button", { name: "Abrir currículo" });
    expect(button.getAttribute("data-path")).toBe("/api/alunos/curriculo");
    expect(screen.queryByText("Currículo não informado.")).toBeNull();
  });

  it.each([
    { possuiCurriculo: true, url: null },
    { possuiCurriculo: false, url: "/api/alunos/curriculo" },
  ])("treats the resume as missing for %o", async (curriculo) => {
    renderView(makeAdminStudentDetail({ curriculo }));
    await findProfile();

    expect(screen.getByText("Currículo não informado.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Abrir currículo" })).toBeNull();
  });
});

describe("AdminStudentDetailView contact", () => {
  it("renders phone, e-mail and URLs as links", async () => {
    renderView();
    await findProfile();

    const contact = section("Contato");
    const phone = contact.getByRole("link", { name: "(32) 99999-8888" });
    expect(phone.getAttribute("href")).toBe("tel:+5532999998888");
    expect(phone.getAttribute("target")).toBeNull();
    const email = contact.getByRole("link", { name: "maria@example.com" });
    expect(email.getAttribute("href")).toBe("mailto:maria@example.com");
    expect(email.getAttribute("rel")).toBeNull();
    for (const [label, url] of [
      ["LinkedIn", "https://linkedin.com/in/maria"],
      ["GitHub", "https://github.com/maria"],
      ["Portfólio", "https://maria.dev"],
    ]) {
      const link = contact.getByRole("link", { name: url });
      expect(link.getAttribute("href")).toBe(url);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noreferrer");
      expect(link.parentElement?.textContent).toContain(`${label}: `);
    }
    expect(contact.queryByText("Não informado.")).toBeNull();
  });

  it("accepts a phone with the country code", async () => {
    renderView(makeAdminStudentDetail({ contato: { ...makeAdminStudentDetail().contato, telefone: "+55 32 99999-8888" } }));
    await findProfile();

    expect(section("Contato").getByRole("link", { name: "(32) 99999-8888" }).getAttribute("href")).toBe("tel:+5532999998888");
  });

  it("shows invalid values as plain text instead of links", async () => {
    renderView(
      makeAdminStudentDetail({
        contato: {
          telefone: "abc",
          emailProfissional: "not-an-email",
          linkedInUrl: "javascript:alert(1)",
          gitHubUrl: "github.com/maria",
          portfolioUrl: "ftp://maria.dev",
        },
      }),
    );
    await findProfile();

    const contact = section("Contato");
    expect(contact.queryAllByRole("link")).toHaveLength(0);
    for (const value of ["abc", "not-an-email", "javascript:alert(1)", "github.com/maria", "ftp://maria.dev"]) {
      expect(contact.getByText(value)).toBeTruthy();
    }
    expect(contact.queryByText("Não informado.")).toBeNull();
  });

  it("hides rows whose value is empty or blank and keeps the informed ones", async () => {
    renderView(
      makeAdminStudentDetail({
        contato: {
          telefone: "   ",
          emailProfissional: "maria@example.com",
          linkedInUrl: "",
          gitHubUrl: null,
          portfolioUrl: null,
        },
      }),
    );
    await findProfile();

    const contact = section("Contato");
    expect(contact.queryByText(/Telefone:/)).toBeNull();
    expect(contact.queryByText(/LinkedIn:/)).toBeNull();
    expect(contact.getByText(/E-mail profissional:/)).toBeTruthy();
    expect(contact.queryByText("Não informado.")).toBeNull();
  });

  it("trims the value before building the link", async () => {
    renderView(
      makeAdminStudentDetail({
        contato: { ...makeAdminStudentDetail().contato, emailProfissional: "  maria@example.com  " },
      }),
    );
    await findProfile();

    expect(section("Contato").getByRole("link", { name: "maria@example.com" }).getAttribute("href")).toBe("mailto:maria@example.com");
  });
});

describe("AdminStudentDetailView formations", () => {
  it("renders a formation with its dates and no RPV controls when it is not RPV", async () => {
    renderView(
      makeAdminStudentDetail({
        formacoes: [makeAdminFormation({ dataFim: "2025-12-15", status: "CONCLUIDO", tipo: "TECNICO" })],
      }),
    );
    await findProfile();

    const formation = section("Formação");
    expect(formation.getByText("Sistemas de Informação")).toBeTruthy();
    expect(formation.getByText("IF Sudeste MG · Técnico · Concluído · 01/02/2022 — 15/12/2025")).toBeTruthy();
    expect(formation.queryByText(/RPV:/)).toBeNull();
    expect(formation.queryByRole("button")).toBeNull();
  });

  it("omits the end date of an ongoing formation", async () => {
    renderView(makeAdminStudentDetail({ formacoes: [makeAdminFormation()] }));
    await findProfile();

    expect(screen.getByText("IF Sudeste MG · Graduação · Em andamento · 01/02/2022")).toBeTruthy();
  });

  it.each([
    { statusValidacaoRpv: null, label: "RPV: Aguardando validação", removeButtons: 0 },
    { statusValidacaoRpv: "PENDENTE" as const, label: "RPV: Aguardando validação", removeButtons: 0 },
    { statusValidacaoRpv: "VERIFICADO" as const, label: "RPV: Verificado pelo Rio Pomba Valley", removeButtons: 1 },
    { statusValidacaoRpv: "REJEITADO" as const, label: "RPV: Validação não aprovada", removeButtons: 0 },
  ])("shows the RPV status $statusValidacaoRpv as '$label' with $removeButtons removal button(s)", async ({ statusValidacaoRpv, label, removeButtons }) => {
    renderView(
      makeAdminStudentDetail({
        formacoes: [makeAdminFormation({ ehRioPombaValley: true, statusValidacaoRpv })],
      }),
    );
    await findProfile();

    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryAllByRole("button", { name: "Remover validação" })).toHaveLength(removeButtons);
  });

  it("offers the protected certificate only when it exists and has a URL", async () => {
    renderView(
      makeAdminStudentDetail({
        formacoes: [
          makeAdminFormation({ id: "f-1", nome: "Com certificado", possuiCertificado: true, certificadoUrl: "/api/certificado/1" }),
          makeAdminFormation({ id: "f-2", nome: "Sem URL", possuiCertificado: true, certificadoUrl: null }),
          makeAdminFormation({ id: "f-3", nome: "Sem certificado", possuiCertificado: false, certificadoUrl: "/api/certificado/3" }),
        ],
      }),
    );
    await findProfile();

    const buttons = screen.getAllByRole("button", { name: "Abrir certificado" });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("data-path")).toBe("/api/certificado/1");
  });
});

describe("AdminStudentDetailView RPV validation removal", () => {
  async function openRemoveDialog(user: ReturnType<typeof userEvent.setup>) {
    renderView(makeAdminStudentDetail({ formacoes: [VERIFIED_FORMATION] }));
    await findProfile();
    await user.click(screen.getByRole("button", { name: "Remover validação" }));
    return screen.findByRole("dialog", { name: REMOVE_TITLE });
  }

  it("asks for confirmation and closes without calling the API on cancel", async () => {
    const user = userEvent.setup();
    const dialog = await openRemoveDialog(user);
    expect(within(dialog).getByText(/A formação e o certificado não serão excluídos/)).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(validationActionMock).not.toHaveBeenCalled();
  });

  it("removes the validation, reloads the profile and shows the notice", async () => {
    const user = userEvent.setup();
    validationActionMock.mockResolvedValue(undefined);
    const dialog = await openRemoveDialog(user);
    studentMock.mockResolvedValue(
      makeAdminStudentDetail({
        formacoes: [{ ...VERIFIED_FORMATION, statusValidacaoRpv: "PENDENTE" }],
      }),
    );

    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText(REMOVE_NOTICE)).toBeTruthy();
    expect(validationActionMock).toHaveBeenCalledWith("f-rpv", "remover-validacao");
    expect(studentMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await screen.findByText("RPV: Aguardando validação")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remover validação" })).toBeNull();
  });

  it("dismisses the notice with Escape", async () => {
    const user = userEvent.setup();
    validationActionMock.mockResolvedValue(undefined);
    const dialog = await openRemoveDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await screen.findByText(REMOVE_NOTICE);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText(REMOVE_NOTICE)).toBeNull());
  });

  it("shows the API error inside the dialog and clears it when the dialog is closed and reopened", async () => {
    const user = userEvent.setup();
    validationActionMock.mockRejectedValue(new ApiError(SERVER_ERROR, "Validação indisponível"));
    const dialog = await openRemoveDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("Validação indisponível");
    expect(within(dialog).getByRole("button", { name: "Confirmar" }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText(REMOVE_NOTICE)).toBeNull();
    expect(studentMock).toHaveBeenCalledTimes(1);

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Remover validação" }));

    const reopened = await screen.findByRole("dialog", { name: REMOVE_TITLE });
    expect(within(reopened).queryByRole("alert")).toBeNull();
  });

  it("uses the fallback message for unknown failures and clears it when a new attempt starts", async () => {
    const user = userEvent.setup();
    validationActionMock.mockRejectedValueOnce("boom").mockResolvedValueOnce(undefined);
    const dialog = await openRemoveDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain(ACTION_FALLBACK);

    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText(REMOVE_NOTICE)).toBeTruthy();
    expect(validationActionMock).toHaveBeenCalledTimes(2);
  });

  it("blocks the dialog while the removal is in progress", async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    validationActionMock.mockReturnValue(pending.promise);
    const dialog = await openRemoveDialog(user);

    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    const busyButton = await within(dialog).findByRole("button", { name: "Processando..." });
    expect(busyButton.hasAttribute("disabled")).toBe(true);
    expect(within(dialog).getByRole("button", { name: "Cancelar" }).hasAttribute("disabled")).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: REMOVE_TITLE })).toBeTruthy();

    pending.resolve();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
