import { act, screen, waitFor, within } from "@testing-library/react";
import { renderThemed as render } from "../recruiter/renderThemed";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardView } from "@/components/admin/AdminDashboardView";
import { adminApi } from "@/lib/admin";
import { ApiError } from "@/lib/api";
import type { AdminDashboard } from "@/types/admin";
import { deferred, makeAdminDashboard } from "./adminFixtures";

vi.setConfig({ testTimeout: 15_000 });

vi.mock("@/lib/admin", () => ({
  adminApi: { dashboard: vi.fn(), demoState: vi.fn() },
}));
const dashboardMock = vi.mocked(adminApi.dashboard);

const LOAD_FALLBACK = "Não foi possível carregar os dados.";
const SERVER_ERROR = 500;
const ACTIVE_STUDENTS = "Alunos ativos";

function cardFor(label: string): HTMLElement {
  const card = screen.getByText(label).closest("a");
  if (!card) throw new Error(`Card not found: ${label}`);
  return card;
}

const demoStateMock = vi.mocked(adminApi.demoState);

function demoIsOff() {
  demoStateMock.mockResolvedValue({ habilitado: false, preparado: false });
}

beforeEach(demoIsOff);

afterEach(() => {
  vi.resetAllMocks();
  // The card mounts once the dashboard has loaded, which can be after the test ended: it must still find an answer.
  demoIsOff();
});

describe("AdminDashboardView", () => {
  it("shows skeletons while the dashboard is loading", () => {
    dashboardMock.mockReturnValue(new Promise(() => undefined));
    const { container } = render(<AdminDashboardView />);

    expect(screen.getByRole("heading", { level: 1, name: "Visão geral" })).toBeTruthy();
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(6);
    expect(screen.queryByText(ACTIVE_STUDENTS)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows each counter as a link to its admin area", async () => {
    dashboardMock.mockResolvedValue(makeAdminDashboard());
    render(<AdminDashboardView />);

    await screen.findByText(ACTIVE_STUDENTS);

    const expected: [string, string, string][] = [
      ["Solicitações de cadastro pendentes", "3", "/admin/solicitacoes"],
      [ACTIVE_STUDENTS, "42", "/admin/alunos"],
      ["Recrutadores ativos", "7", "/admin/recrutadores"],
      ["Validações RPV pendentes", "5", "/admin/validacoes-rpv"],
      ["Perfis atualizados nos últimos 7 dias", "18", "/admin/alunos"],
      ["Formações RPV verificadas", "11", "/admin/validacoes-rpv"],
    ];
    for (const [label, value, href] of expected) {
      const card = cardFor(label);
      expect(card.getAttribute("href")).toBe(href);
      expect(within(card).getByText(value)).toBeTruthy();
    }
    expect(dashboardMock).toHaveBeenCalledTimes(1);
  });

  it("highlights only the cards that ask for attention", async () => {
    dashboardMock.mockResolvedValue(makeAdminDashboard());
    render(<AdminDashboardView />);
    await screen.findByText(ACTIVE_STUDENTS);

    expect(cardFor("Solicitações de cadastro pendentes").getAttribute("aria-label")).toContain("requer atenção");
    expect(cardFor("Validações RPV pendentes").getAttribute("aria-label")).toContain("requer atenção");
    expect(cardFor(ACTIVE_STUDENTS).getAttribute("aria-label")).not.toContain("requer atenção");
  });

  it("does not highlight pending cards that are at zero", async () => {
    dashboardMock.mockResolvedValue(makeAdminDashboard({ solicitacoesCadastroPendentes: 0, validacoesRpvPendentes: 0 }));
    render(<AdminDashboardView />);
    await screen.findByText(ACTIVE_STUDENTS);

    expect(cardFor("Solicitações de cadastro pendentes").getAttribute("aria-label")).not.toContain("requer atenção");
    expect(cardFor("Validações RPV pendentes").getAttribute("aria-label")).not.toContain("requer atenção");
  });

  it("lists the most used skills with their student counts", async () => {
    dashboardMock.mockResolvedValue(makeAdminDashboard());
    render(<AdminDashboardView />);

    expect(await screen.findByText("React · 20")).toBeTruthy();
    expect(screen.getByText("TypeScript · 15")).toBeTruthy();
    expect(screen.queryByText("Ainda não há competências cadastradas em perfis ativos.")).toBeNull();
  });

  it("shows a message when there are no skills in active profiles", async () => {
    dashboardMock.mockResolvedValue(makeAdminDashboard({ competenciasMaisUtilizadas: [] }));
    render(<AdminDashboardView />);

    expect(await screen.findByText("Ainda não há competências cadastradas em perfis ativos.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Competências mais utilizadas" })).toBeTruthy();
  });

  it("works with zeroed counters", async () => {
    const empty: AdminDashboard = makeAdminDashboard({
      alunosAtivos: 0,
      recrutadoresAtivos: 0,
      solicitacoesCadastroPendentes: 0,
      validacoesRpvPendentes: 0,
      perfisAtualizadosUltimos7Dias: 0,
      formacoesRpvVerificadas: 0,
      competenciasMaisUtilizadas: [],
    });
    dashboardMock.mockResolvedValue(empty);
    render(<AdminDashboardView />);

    await screen.findByText(ACTIVE_STUDENTS);

    expect(within(cardFor("Solicitações de cadastro pendentes")).getByText("0")).toBeTruthy();
    expect(within(cardFor("Validações RPV pendentes")).getByText("0")).toBeTruthy();
  });

  it("has no repeated row of buttons and links the indicator cards to their areas", async () => {
    dashboardMock.mockResolvedValue(makeAdminDashboard());
    render(<AdminDashboardView />);
    await screen.findByText(ACTIVE_STUDENTS);

    for (const name of ["Analisar solicitações", "Gerenciar alunos", "Gerenciar recrutadores", "Ver validações RPV", "Ver auditoria"]) {
      expect(screen.queryByRole("link", { name })).toBeNull();
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    for (const href of ["/admin/solicitacoes", "/admin/alunos", "/admin/recrutadores", "/admin/validacoes-rpv"]) {
      expect(hrefs).toContain(href);
    }
  });

  it("shows nothing about the demonstration while it is off on the server", async () => {
    dashboardMock.mockResolvedValue(makeAdminDashboard());
    render(<AdminDashboardView />);
    await screen.findByText(ACTIVE_STUDENTS);

    await waitFor(() => expect(demoStateMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Demonstração" })).toBeNull();
  });

  it("shows the demonstration card when it is on on the server", async () => {
    demoStateMock.mockResolvedValue({ habilitado: true, preparado: false });
    dashboardMock.mockResolvedValue(makeAdminDashboard());
    render(<AdminDashboardView />);

    expect(await screen.findByRole("heading", { name: "Demonstração" })).toBeTruthy();
  });

  it("shows the API error message and retries", async () => {
    dashboardMock
      .mockRejectedValueOnce(new ApiError(SERVER_ERROR, "Falha no servidor"))
      .mockResolvedValueOnce(makeAdminDashboard());
    const user = userEvent.setup();
    render(<AdminDashboardView />);

    expect((await screen.findByRole("alert")).textContent).toContain("Falha no servidor");
    expect(screen.queryByText(ACTIVE_STUDENTS)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText(ACTIVE_STUDENTS)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(dashboardMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback message for unknown loading failures", async () => {
    dashboardMock.mockRejectedValue("boom");
    render(<AdminDashboardView />);

    expect((await screen.findByRole("alert")).textContent).toContain(LOAD_FALLBACK);
  });

  it("uses the message of a generic error", async () => {
    dashboardMock.mockRejectedValue(new Error("Sem conexão"));
    render(<AdminDashboardView />);

    expect((await screen.findByRole("alert")).textContent).toContain("Sem conexão");
  });

  // The unmounted state update is a silent no-op in React 19, so these cases only exercise the
  // late-settle path; a regression would surface as an unhandled rejection or a thrown error.
  it("settles a result that arrives after the view is unmounted without errors", async () => {
    const pending = deferred<AdminDashboard>();
    dashboardMock.mockReturnValue(pending.promise);
    const { unmount } = render(<AdminDashboardView />);
    unmount();

    await act(async () => {
      pending.resolve(makeAdminDashboard());
    });

    expect(dashboardMock).toHaveBeenCalledTimes(1);
  });

  it("settles a failure that arrives after the view is unmounted without errors", async () => {
    const pending = deferred<AdminDashboard>();
    dashboardMock.mockReturnValue(pending.promise);
    const { unmount } = render(<AdminDashboardView />);
    unmount();

    await act(async () => {
      pending.reject(new Error("tarde demais"));
    });

    expect(dashboardMock).toHaveBeenCalledTimes(1);
  });
});
