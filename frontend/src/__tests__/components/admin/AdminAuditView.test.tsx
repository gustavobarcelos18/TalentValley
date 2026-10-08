import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminAuditView } from "@/components/admin/AdminViews";
import { adminApi } from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";
import { makePaginated } from "./adminFixtures";
import { makeAuditItem } from "./adminRecruiterFixtures";

vi.setConfig({ testTimeout: 15_000 });

vi.mock("@/lib/admin", () => ({
  adminApi: { audit: vi.fn() },
}));

const auditMock = vi.mocked(adminApi.audit);

const LOAD_FALLBACK = "Não foi possível carregar os dados.";
const SERVER_ERROR = 500;

afterEach(() => {
  vi.resetAllMocks();
});

describe("AdminAuditView", () => {
  it("shows the skeleton while the records load", () => {
    auditMock.mockReturnValue(new Promise(() => undefined));

    render(<AdminAuditView />);

    expect(screen.getByRole("heading", { name: "Auditoria" })).toBeTruthy();
    expect(screen.queryByText("Nenhum registro de auditoria")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("lists the records formatting action, date, description, admin and entity", async () => {
    const first = makeAuditItem();
    const second = makeAuditItem({
      id: "aud-2",
      acao: "APROVAR_FORMACAO",
      adminEmail: "outro@riopombavalley.com.br",
      entidadeTipo: "Formacao",
      entidadeId: "for-9",
      descricao: "Formação aprovada.",
      criadoEm: "2026-09-02T08:30:00Z",
    });
    auditMock.mockResolvedValue(makePaginated([first, second]));

    render(<AdminAuditView />);

    expect(await screen.findByRole("heading", { name: first.acao })).toBeTruthy();
    expect(screen.getByRole("heading", { name: second.acao })).toBeTruthy();
    expect(screen.getByText(first.descricao)).toBeTruthy();
    expect(screen.getByText(first.adminEmail)).toBeTruthy();
    expect(screen.getByText("Recrutador: rec-1")).toBeTruthy();
    expect(screen.getByText("Formacao: for-9")).toBeTruthy();
    expect(screen.getByText(formatUpdatedAt(first.criadoEm))).toBeTruthy();
    expect(screen.getByText(formatUpdatedAt(second.criadoEm))).toBeTruthy();
    expect(auditMock).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("shows the empty state when there are no records", async () => {
    auditMock.mockResolvedValue(makePaginated([]));

    render(<AdminAuditView />);

    expect(await screen.findByText("Nenhum registro de auditoria")).toBeTruthy();
    expect(screen.getByText("As ações administrativas aparecerão aqui.")).toBeTruthy();
  });

  it("paginates the records when another page is chosen", async () => {
    const user = userEvent.setup();
    auditMock.mockImplementation((page) =>
      Promise.resolve(
        makePaginated([makeAuditItem({ id: `aud-${page}`, acao: `ACAO_PAGINA_${page}` })], page, 3),
      ),
    );

    render(<AdminAuditView />);

    expect(await screen.findByRole("heading", { name: "ACAO_PAGINA_1" })).toBeTruthy();
    const pager = screen.getByRole("navigation");
    await user.click(within(pager).getByRole("button", { name: "Go to page 2" }));

    expect(await screen.findByRole("heading", { name: "ACAO_PAGINA_2" })).toBeTruthy();
    expect(auditMock).toHaveBeenLastCalledWith(2);
  });

  it("shows the API message and reloads on retry", async () => {
    const user = userEvent.setup();
    auditMock
      .mockRejectedValueOnce(new ApiError(SERVER_ERROR, "falha", { title: "Auditoria indisponível" }))
      .mockResolvedValueOnce(makePaginated([makeAuditItem()]));

    render(<AdminAuditView />);

    expect(await screen.findByText("Auditoria indisponível")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("heading", { name: "BLOQUEAR_RECRUTADOR" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(auditMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback message when the error has no message", async () => {
    auditMock.mockRejectedValue("falha desconhecida");

    render(<AdminAuditView />);

    expect(await screen.findByText(LOAD_FALLBACK)).toBeTruthy();
    expect(screen.queryByText("Nenhum registro de auditoria")).toBeNull();
  });
});
