import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDemoCard } from "@/components/demo/AdminDemoCard";
import { adminApi } from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { enterDemo } from "@/lib/auth";
import { renderThemed as render } from "../recruiter/renderThemed";
import { userWith } from "../auth/authMock";

vi.mock("@/lib/admin", () => ({ adminApi: { demoState: vi.fn(), prepareDemo: vi.fn(), restoreDemo: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ enterDemo: vi.fn() }));

const stateMock = vi.mocked(adminApi.demoState);
const prepareMock = vi.mocked(adminApi.prepareDemo);
const restoreMock = vi.mocked(adminApi.restoreDemo);
const enterMock = vi.mocked(enterDemo);

const PREPARE = "Preparar demonstração";
const RESTORE = "Restaurar demonstração";
const VIEW_STUDENT = "Ver como Aluno";
const VIEW_RECRUITER = "Ver como Recrutador";
const DESTINATION = { ALUNO: "/meu-perfil", RECRUTADOR: "/recrutador" } as const;
const assignMock = vi.fn();

function stateIs(habilitado: boolean, preparado: boolean) {
  stateMock.mockResolvedValue({ habilitado, preparado });
}

describe("AdminDemoCard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("location", { ...window.location, assign: assignMock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders nothing while the state loads", () => {
    stateMock.mockReturnValue(new Promise(() => undefined));
    render(<AdminDemoCard />);

    expect(screen.queryByRole("heading", { name: "Demonstração" })).toBeNull();
  });

  it("renders nothing when demonstration mode is off on the server", async () => {
    stateIs(false, true);
    render(<AdminDemoCard />);

    await waitFor(() => expect(stateMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Demonstração" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders nothing when the state cannot be loaded", async () => {
    stateMock.mockRejectedValue(new ApiError(500, "falha"));
    render(<AdminDemoCard />);

    await waitFor(() => expect(stateMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Demonstração" })).toBeNull();
  });

  it("offers only to prepare when the accounts do not exist yet", async () => {
    stateIs(true, false);
    render(<AdminDemoCard />);

    expect(await screen.findByRole("button", { name: PREPARE })).toBeTruthy();
    expect(screen.getByText("Não preparada")).toBeTruthy();
    for (const name of [VIEW_STUDENT, VIEW_RECRUITER, RESTORE]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("prepares, reports what was created and then offers the other actions", async () => {
    stateMock.mockResolvedValueOnce({ habilitado: true, preparado: false }).mockResolvedValue({ habilitado: true, preparado: true });
    prepareMock.mockResolvedValue({ alunosCriados: 5, recrutadoresCriados: 1 });
    const user = userEvent.setup();
    render(<AdminDemoCard />);

    await user.click(await screen.findByRole("button", { name: PREPARE }));

    expect((await screen.findByRole("status")).textContent).toContain("Demonstração preparada: 5 alunos e 1 recrutador fictícios");
    expect(await screen.findByRole("button", { name: VIEW_STUDENT })).toBeTruthy();
    expect(screen.getByText("Preparada")).toBeTruthy();
    expect(screen.queryByRole("button", { name: PREPARE })).toBeNull();
  });

  it("shows the server message when preparing is refused with a conflict", async () => {
    stateIs(true, false);
    prepareMock.mockRejectedValue(new ApiError(409, "Conflito", { title: "O e-mail de uma conta de demonstração já pertence a uma conta real." }));
    const user = userEvent.setup();
    render(<AdminDemoCard />);

    await user.click(await screen.findByRole("button", { name: PREPARE }));

    expect((await screen.findByRole("alert")).textContent).toContain("já pertence a uma conta real");
    expect((screen.getByRole("button", { name: PREPARE }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("uses its own text, not the server's, for other failures", async () => {
    stateIs(true, false);
    prepareMock.mockRejectedValue(new ApiError(500, "Internal", { title: "Erro interno em inglês" }));
    const user = userEvent.setup();
    render(<AdminDemoCard />);

    await user.click(await screen.findByRole("button", { name: PREPARE }));

    expect((await screen.findByRole("alert")).textContent).toBe("Não foi possível concluir a operação. Tente novamente.");
  });

  it.each([
    [VIEW_STUDENT, "ALUNO"],
    [VIEW_RECRUITER, "RECRUTADOR"],
  ] as const)("%s: enters the account and loads its start page from scratch", async (label, papel) => {
    stateIs(true, true);
    enterMock.mockResolvedValue({ usuario: { ...userWith(papel), modoDemonstracao: true }, destinoInicial: DESTINATION[papel] });
    const user = userEvent.setup();
    render(<AdminDemoCard />);

    await user.click(await screen.findByRole("button", { name: label }));

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith(DESTINATION[papel]));
    expect(enterMock).toHaveBeenCalledWith(papel);
  });

  it("stays on the screen with a message when entering fails", async () => {
    stateIs(true, true);
    enterMock.mockRejectedValue(new ApiError(409, "Conflito", { title: "A conta de demonstração não está disponível. Prepare a demonstração." }));
    const user = userEvent.setup();
    render(<AdminDemoCard />);

    await user.click(await screen.findByRole("button", { name: VIEW_STUDENT }));

    expect((await screen.findByRole("alert")).textContent).toContain("A conta de demonstração não está disponível");
    expect(assignMock).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: VIEW_STUDENT }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("asks for confirmation before restoring and does nothing if cancelled", async () => {
    stateIs(true, true);
    const user = userEvent.setup();
    render(<AdminDemoCard />);

    await user.click(await screen.findByRole("button", { name: RESTORE }));
    const dialog = await screen.findByRole("dialog", { name: "Restaurar demonstração?" });
    expect(dialog.textContent).toContain("Contas reais não são afetadas.");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(restoreMock).not.toHaveBeenCalled();
  });

  it("restores after confirmation and reloads the state", async () => {
    stateIs(true, true);
    restoreMock.mockResolvedValue({ alunosCriados: 5, recrutadoresCriados: 1 });
    const user = userEvent.setup();
    render(<AdminDemoCard />);

    await user.click(await screen.findByRole("button", { name: RESTORE }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Confirmar" }));

    expect((await screen.findByRole("status")).textContent).toContain("Demonstração restaurada: 5 alunos e 1 recrutador fictícios");
    expect(restoreMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(stateMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
