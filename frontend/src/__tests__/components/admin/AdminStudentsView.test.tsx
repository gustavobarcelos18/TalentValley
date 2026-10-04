import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminStudentsView } from "@/components/admin/AdminViews";
import { adminApi } from "@/lib/admin";
import { ApiError } from "@/lib/api";
import type { AdminStudentCreated, AdminStudentListItem, PaginatedResponse } from "@/types/admin";
import { deferred, makePaginated, makeStudentCreated, makeStudentListItem } from "./adminFixtures";

vi.setConfig({ testTimeout: 15_000 });

vi.mock("@/hooks/useProtectedFile", () => ({
  useProtectedFile: () => ({ url: null, loading: false, error: null, reload: vi.fn() }),
}));
vi.mock("@/lib/admin", () => ({
  adminApi: {
    students: vi.fn(),
    studentAction: vi.fn(),
    deleteStudent: vi.fn(),
    createStudent: vi.fn(),
    resendActivation: vi.fn(),
  },
}));

const studentsMock = vi.mocked(adminApi.students);
const actionMock = vi.mocked(adminApi.studentAction);
const deleteMock = vi.mocked(adminApi.deleteStudent);
const createMock = vi.mocked(adminApi.createStudent);
const resendMock = vi.mocked(adminApi.resendActivation);

type StudentsPage = PaginatedResponse<AdminStudentListItem>;

const SERVER_ERROR = 500;
const LOAD_FALLBACK = "Não foi possível carregar os dados.";
const ACTION_FALLBACK = "Não foi possível concluir a ação.";
const DELETE_FALLBACK = "Não foi possível excluir o aluno.";
const CREATE_FALLBACK = "Não foi possível criar o acesso.";
const CREATE_LABEL = "Criar acesso de aluno";
const BLOCK_TITLE = "Bloquear aluno?";
const REACTIVATE_TITLE = "Reativar aluno?";
const DELETE_TITLE = "Excluir aluno permanentemente?";
const BLOCKED_NOTICE = "Aluno bloqueado.";
const CREATED_NOTICE = "Acesso de aluno criado e email de ativação enviado.";
const NOTICE_AUTO_HIDE_MS = 5000;

const ANA = makeStudentListItem({ atualizadoEm: "2026-09-01T15:00:00Z" });
const BRUNO = makeStudentListItem({
  id: "aluno-2",
  slug: "bruno-reis",
  nomeCompleto: "Bruno Reis",
  ativo: false,
  cidade: null,
  uf: null,
});

async function renderLoaded(items: AdminStudentListItem[], page = 1, totalPages = 1) {
  studentsMock.mockResolvedValue(makePaginated(items, page, totalPages));
  const user = userEvent.setup();
  render(<AdminStudentsView />);
  await screen.findByRole("heading", { level: 1, name: "Alunos" });
  if (items.length) await screen.findByText(items[0].nomeCompleto);
  return user;
}

async function openDialog(user: UserEvent, buttonName: string, dialogName: string) {
  await user.click(screen.getAllByRole("button", { name: buttonName })[0]);
  return screen.findByRole("dialog", { name: dialogName });
}

async function confirmIn(user: UserEvent, dialog: HTMLElement) {
  await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));
}

async function closed() {
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
}

async function search(user: UserEvent, term: string) {
  const field = screen.getByRole("textbox", { name: "Buscar por nome" });
  await user.clear(field);
  if (term) await user.type(field, term);
  await user.click(screen.getByRole("button", { name: "Buscar" }));
}

async function openCreate(user: UserEvent) {
  await user.click(screen.getByRole("button", { name: CREATE_LABEL }));
  return screen.findByRole("dialog", { name: CREATE_LABEL });
}

async function fillCreate(user: UserEvent, dialog: HTMLElement, name: string, email: string) {
  if (name) await user.type(within(dialog).getByRole("textbox", { name: /Nome completo/ }), name);
  if (email) await user.type(within(dialog).getByRole("textbox", { name: /E-mail/ }), email);
}

async function submitCreate(user: UserEvent, dialog: HTMLElement) {
  await user.click(within(dialog).getByRole("button", { name: "Criar acesso" }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("AdminStudentsView listing", () => {
  it("shows the search form and skeletons while loading", () => {
    studentsMock.mockReturnValue(new Promise(() => undefined));
    const { container } = render(<AdminStudentsView />);

    expect(screen.getByRole("heading", { level: 1, name: "Alunos" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Buscar por nome" })).toBeTruthy();
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(3);
    expect(screen.queryByText("Nenhum aluno encontrado.")).toBeNull();
    expect(studentsMock).toHaveBeenCalledWith(1, "");
  });

  it("lists students with location, update date, status and actions", async () => {
    await renderLoaded([ANA, BRUNO]);

    expect(screen.getByText(/Rio Pomba \/ MG/)).toBeTruthy();
    expect(screen.getAllByText(/Atualizado 01\/09\/2026/)).toHaveLength(2);
    expect(screen.getByText(/Localização não informada/)).toBeTruthy();
    expect(screen.getByText("Ativo")).toBeTruthy();
    expect(screen.getByText("Bloqueado")).toBeTruthy();
    const profileLinks = screen.getAllByRole("link", { name: "Ver perfil" });
    expect(profileLinks.map((link) => link.getAttribute("href"))).toEqual(["/admin/alunos/aluno-1", "/admin/alunos/aluno-2"]);
    expect(screen.getAllByRole("button", { name: "Bloquear" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Reativar" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Excluir" })).toHaveLength(1);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it.each([
    { cidade: "Ubá", uf: null, expected: /Ubá ·/ },
    { cidade: null, uf: "MG", expected: /MG ·/ },
  ])("shows only the known part of the location ($cidade / $uf)", async ({ cidade, uf, expected }) => {
    await renderLoaded([makeStudentListItem({ cidade, uf })]);

    expect(screen.getByText(expected)).toBeTruthy();
    expect(screen.queryByText(/Localização não informada/)).toBeNull();
  });

  it("shows the empty state", async () => {
    await renderLoaded([]);

    expect(await screen.findByText("Nenhum aluno encontrado.")).toBeTruthy();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("shows the API error message and retries", async () => {
    studentsMock
      .mockRejectedValueOnce(new ApiError(SERVER_ERROR, "Falha no servidor"))
      .mockResolvedValueOnce(makePaginated([ANA]));
    const user = userEvent.setup();
    render(<AdminStudentsView />);

    expect((await screen.findByRole("alert")).textContent).toContain("Falha no servidor");
    expect(screen.queryByText("Nenhum aluno encontrado.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Ana Lima")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(studentsMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback message for unknown loading failures", async () => {
    studentsMock.mockRejectedValue("boom");
    render(<AdminStudentsView />);

    expect((await screen.findByRole("alert")).textContent).toContain(LOAD_FALLBACK);
  });

  it("changes page with the pagination control", async () => {
    const user = await renderLoaded([ANA], 1, 3);
    studentsMock.mockResolvedValue(makePaginated([BRUNO], 2, 3));

    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /page 2/i }));

    expect(await screen.findByText("Bruno Reis")).toBeTruthy();
    expect(studentsMock).toHaveBeenLastCalledWith(2, "");
    expect(screen.queryByText("Ana Lima")).toBeNull();
  });

  it("keeps only the newest result when an older request finishes later", async () => {
    const first = deferred<StudentsPage>();
    const second = deferred<StudentsPage>();
    studentsMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const user = userEvent.setup();
    render(<AdminStudentsView />);

    await search(user, "bruno");
    await act(async () => {
      second.resolve(makePaginated([BRUNO]));
    });
    expect(await screen.findByText("Bruno Reis")).toBeTruthy();
    await act(async () => {
      first.resolve(makePaginated([ANA]));
    });

    expect(screen.queryByText("Ana Lima")).toBeNull();
    expect(screen.getByText("Bruno Reis")).toBeTruthy();
  });

  it("ignores the failure of an older request that finishes later", async () => {
    const first = deferred<StudentsPage>();
    const second = deferred<StudentsPage>();
    studentsMock.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const user = userEvent.setup();
    render(<AdminStudentsView />);

    await search(user, "bruno");
    await act(async () => {
      second.resolve(makePaginated([BRUNO]));
    });
    await screen.findByText("Bruno Reis");
    await act(async () => {
      first.reject(new Error("tarde demais"));
    });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Bruno Reis")).toBeTruthy();
  });

  // The unmounted state update is a silent no-op in React 19, so these cases only exercise the
  // late-settle path; a regression would surface as an unhandled rejection or a thrown error.
  it("settles a result that arrives after the view is unmounted without errors", async () => {
    const pending = deferred<StudentsPage>();
    studentsMock.mockReturnValue(pending.promise);
    const { unmount } = render(<AdminStudentsView />);
    unmount();

    await act(async () => {
      pending.resolve(makePaginated([ANA]));
    });

    expect(studentsMock).toHaveBeenCalledTimes(1);
  });

  it("settles a failure that arrives after the view is unmounted without errors", async () => {
    const pending = deferred<StudentsPage>();
    studentsMock.mockReturnValue(pending.promise);
    const { unmount } = render(<AdminStudentsView />);
    unmount();

    await act(async () => {
      pending.reject(new Error("tarde demais"));
    });

    expect(studentsMock).toHaveBeenCalledTimes(1);
  });
});

describe("AdminStudentsView search", () => {
  it("searches by the trimmed term and returns to the first page", async () => {
    const user = await renderLoaded([ANA], 1, 2);
    studentsMock.mockResolvedValue(makePaginated([BRUNO], 2, 2));
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /page 2/i }));
    await screen.findByText("Bruno Reis");
    studentsMock.mockResolvedValue(makePaginated([ANA]));

    await search(user, "  ana ");

    expect(await screen.findByText("Ana Lima")).toBeTruthy();
    expect(studentsMock).toHaveBeenLastCalledWith(1, "ana");
  });

  it("can clear a previous search", async () => {
    const user = await renderLoaded([ANA]);
    await search(user, "ana");
    await waitFor(() => expect(studentsMock).toHaveBeenLastCalledWith(1, "ana"));

    await search(user, "");

    await waitFor(() => expect(studentsMock).toHaveBeenLastCalledWith(1, ""));
  });

  it("rejects an invalid term without searching, then accepts a valid one", async () => {
    const user = await renderLoaded([ANA]);
    const callsBefore = studentsMock.mock.calls.length;

    await search(user, "😀");

    expect(screen.getByText("Informe uma busca válida.")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Buscar por nome" }).getAttribute("aria-invalid")).toBe("true");
    expect(studentsMock).toHaveBeenCalledTimes(callsBefore);

    await search(user, "ana");

    await waitFor(() => expect(screen.queryByText("Informe uma busca válida.")).toBeNull());
    expect(studentsMock).toHaveBeenLastCalledWith(1, "ana");
  });
});

describe("AdminStudentsView block and reactivate", () => {
  it("blocks an active student after confirmation", async () => {
    const user = await renderLoaded([ANA]);
    studentsMock.mockResolvedValue(makePaginated([{ ...ANA, ativo: false }]));
    actionMock.mockResolvedValue(undefined);

    const dialog = await openDialog(user, "Bloquear", BLOCK_TITLE);
    expect(within(dialog).getByText(/Bloquear Ana Lima\? O aluno perderá o acesso/)).toBeTruthy();
    await confirmIn(user, dialog);

    expect(await screen.findByText(BLOCKED_NOTICE)).toBeTruthy();
    await closed();
    expect(actionMock).toHaveBeenCalledWith("aluno-1", "bloquear");
    expect(await screen.findByText("Bloqueado")).toBeTruthy();
    expect(studentsMock).toHaveBeenCalledTimes(2);
  });

  it("reactivates a blocked student after confirmation", async () => {
    const user = await renderLoaded([BRUNO]);
    actionMock.mockResolvedValue(undefined);

    const dialog = await openDialog(user, "Reativar", REACTIVATE_TITLE);
    expect(within(dialog).getByText(/Deseja reativar Bruno Reis\? O acesso à conta será restaurado/)).toBeTruthy();
    await confirmIn(user, dialog);

    expect(await screen.findByText("Aluno reativado.")).toBeTruthy();
    expect(actionMock).toHaveBeenCalledWith("aluno-2", "reativar");
    await waitFor(() => expect(studentsMock).toHaveBeenCalledTimes(2));
  });

  it("dismisses the success notice with Escape", async () => {
    const user = await renderLoaded([ANA]);
    actionMock.mockResolvedValue(undefined);
    const dialog = await openDialog(user, "Bloquear", BLOCK_TITLE);
    await confirmIn(user, dialog);
    await screen.findByText(BLOCKED_NOTICE);
    await closed();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText(BLOCKED_NOTICE)).toBeNull());
  });

  it("closes the notice by itself after a few seconds", async () => {
    const user = await renderLoaded([ANA]);
    actionMock.mockResolvedValue(undefined);
    const dialog = await openDialog(user, "Bloquear", BLOCK_TITLE);
    vi.useFakeTimers();

    fireEvent.click(within(dialog).getByRole("button", { name: "Confirmar" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(BLOCKED_NOTICE)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NOTICE_AUTO_HIDE_MS - 1);
    });
    expect(screen.getByText(BLOCKED_NOTICE)).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(screen.queryByText(BLOCKED_NOTICE)).toBeNull();
  });

  it("cancels without calling the API", async () => {
    const user = await renderLoaded([ANA]);

    const dialog = await openDialog(user, "Bloquear", BLOCK_TITLE);
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await closed();
    expect(actionMock).not.toHaveBeenCalled();
    expect(screen.queryByText(BLOCKED_NOTICE)).toBeNull();
  });

  it("shows the API error inside the dialog and clears it on cancel", async () => {
    const user = await renderLoaded([ANA]);
    actionMock.mockRejectedValue(new ApiError(SERVER_ERROR, "Falha no servidor"));

    const dialog = await openDialog(user, "Bloquear", BLOCK_TITLE);
    await confirmIn(user, dialog);

    expect((await within(dialog).findByRole("alert")).textContent).toContain("Falha no servidor");
    expect(screen.queryByText(BLOCKED_NOTICE)).toBeNull();
    expect((within(dialog).getByRole("button", { name: "Confirmar" }) as HTMLButtonElement).disabled).toBe(false);

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await closed();
    const reopened = await openDialog(user, "Bloquear", BLOCK_TITLE);

    expect(within(reopened).queryByRole("alert")).toBeNull();
  });

  it("uses the fallback message when the action fails with an unknown error", async () => {
    const user = await renderLoaded([ANA]);
    actionMock.mockRejectedValue("boom");

    const dialog = await openDialog(user, "Bloquear", BLOCK_TITLE);
    await confirmIn(user, dialog);

    expect((await within(dialog).findByRole("alert")).textContent).toContain(ACTION_FALLBACK);
  });

  it("clears an old error when another action is opened", async () => {
    const user = await renderLoaded([ANA]);
    actionMock.mockRejectedValue("boom");
    const dialog = await openDialog(user, "Bloquear", BLOCK_TITLE);
    await confirmIn(user, dialog);
    await within(dialog).findByRole("alert");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await closed();
    actionMock.mockResolvedValue(undefined);

    const again = await openDialog(user, "Bloquear", BLOCK_TITLE);

    expect(within(again).queryByRole("alert")).toBeNull();
  });

  it("is busy while the action runs and cannot be dismissed", async () => {
    const user = await renderLoaded([ANA]);
    const pending = deferred<void>();
    actionMock.mockReturnValue(pending.promise);

    const dialog = await openDialog(user, "Bloquear", BLOCK_TITLE);
    await confirmIn(user, dialog);

    const working = await within(dialog).findByRole("button", { name: "Processando..." });
    expect((working as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: BLOCK_TITLE })).toBeTruthy();

    pending.resolve();
    await closed();
    expect(await screen.findByText(BLOCKED_NOTICE)).toBeTruthy();
  });
});

describe("AdminStudentsView permanent deletion", () => {
  it("only offers deletion for blocked students", async () => {
    await renderLoaded([ANA]);

    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
  });

  it("deletes a blocked student after confirmation and reloads the list", async () => {
    const user = await renderLoaded([ANA, BRUNO]);
    studentsMock.mockResolvedValue(makePaginated([ANA]));
    deleteMock.mockResolvedValue(undefined);

    const dialog = await openDialog(user, "Excluir", DELETE_TITLE);
    expect(within(dialog).getByText("A exclusão de Bruno Reis é permanente e não poderá ser desfeita.")).toBeTruthy();
    await confirmIn(user, dialog);

    expect(await screen.findByText("Aluno excluído permanentemente.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Bruno Reis")).toBeNull());
    expect(deleteMock).toHaveBeenCalledWith("aluno-2");
    expect(studentsMock).toHaveBeenCalledTimes(2);
    expect(studentsMock).toHaveBeenLastCalledWith(1, "");
  });

  it("goes back one page when the only student of a later page is deleted", async () => {
    const user = await renderLoaded([ANA], 1, 2);
    studentsMock.mockResolvedValue(makePaginated([BRUNO], 2, 2));
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /page 2/i }));
    await screen.findByText("Bruno Reis");
    studentsMock.mockResolvedValue(makePaginated([ANA], 1, 1));
    deleteMock.mockResolvedValue(undefined);

    const dialog = await openDialog(user, "Excluir", DELETE_TITLE);
    await confirmIn(user, dialog);

    expect(await screen.findByText("Ana Lima")).toBeTruthy();
    expect(studentsMock).toHaveBeenLastCalledWith(1, "");
    expect(deleteMock).toHaveBeenCalledWith("aluno-2");
  });

  it("stays on the same page when other students remain after the deletion", async () => {
    const user = await renderLoaded([ANA], 1, 2);
    studentsMock.mockResolvedValue(makePaginated([ANA, BRUNO], 2, 2));
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /page 2/i }));
    await screen.findByText("Bruno Reis");
    studentsMock.mockResolvedValue(makePaginated([ANA], 2, 2));
    deleteMock.mockResolvedValue(undefined);

    const dialog = await openDialog(user, "Excluir", DELETE_TITLE);
    await confirmIn(user, dialog);

    await waitFor(() => expect(screen.queryByText("Bruno Reis")).toBeNull());
    expect(studentsMock).toHaveBeenLastCalledWith(2, "");
  });

  it("cancels without deleting", async () => {
    const user = await renderLoaded([BRUNO]);

    const dialog = await openDialog(user, "Excluir", DELETE_TITLE);
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await closed();
    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getByText("Bruno Reis")).toBeTruthy();
  });

  it("shows the API error inside the dialog and keeps the student", async () => {
    const user = await renderLoaded([BRUNO]);
    deleteMock.mockRejectedValue(new ApiError(SERVER_ERROR, "Aluno possui vínculos"));

    const dialog = await openDialog(user, "Excluir", DELETE_TITLE);
    await confirmIn(user, dialog);

    expect((await within(dialog).findByRole("alert")).textContent).toContain("Aluno possui vínculos");
    expect(screen.queryByText("Aluno excluído permanentemente.")).toBeNull();
    expect(studentsMock).toHaveBeenCalledTimes(1);
  });

  it("uses the fallback message when the deletion fails with an unknown error", async () => {
    const user = await renderLoaded([BRUNO]);
    deleteMock.mockRejectedValue("boom");

    const dialog = await openDialog(user, "Excluir", DELETE_TITLE);
    await confirmIn(user, dialog);

    expect((await within(dialog).findByRole("alert")).textContent).toContain(DELETE_FALLBACK);
  });
});

describe("AdminStudentsView create access", () => {
  async function createdAfter(user: UserEvent, created: AdminStudentCreated) {
    createMock.mockResolvedValue(created);
    const dialog = await openCreate(user);
    await fillCreate(user, dialog, "Novo Aluno", "novo@example.com");
    await submitCreate(user, dialog);
    await closed();
  }

  it("opens and closes the creation dialog", async () => {
    const user = await renderLoaded([ANA]);

    const dialog = await openCreate(user);
    expect(within(dialog).getByRole("textbox", { name: /Nome completo/ })).toBeTruthy();
    expect(within(dialog).getByRole("textbox", { name: /E-mail/ })).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await closed();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates the access with trimmed data and announces that the email was sent", async () => {
    const user = await renderLoaded([ANA]);
    createMock.mockResolvedValue(makeStudentCreated());

    const dialog = await openCreate(user);
    await fillCreate(user, dialog, "  Maria Souza ", "maria@example.com");
    await submitCreate(user, dialog);

    expect(await screen.findByText(CREATED_NOTICE)).toBeTruthy();
    await closed();
    expect(createMock).toHaveBeenCalledWith({ nomeCompleto: "Maria Souza", email: "maria@example.com" });
    await waitFor(() => expect(studentsMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Reenviar ativação" })).toBeNull();
  });

  it("clears the form after a successful creation", async () => {
    const user = await renderLoaded([ANA]);
    await createdAfter(user, makeStudentCreated());

    const reopened = await openCreate(user);

    expect((within(reopened).getByRole("textbox", { name: /Nome completo/ }) as HTMLInputElement).value).toBe("");
    expect((within(reopened).getByRole("textbox", { name: /E-mail/ }) as HTMLInputElement).value).toBe("");
  });

  it("removes digits typed into the name field", async () => {
    const user = await renderLoaded([ANA]);

    const dialog = await openCreate(user);
    await fillCreate(user, dialog, "Ana2 Souza7", "");

    expect((within(dialog).getByRole("textbox", { name: /Nome completo/ }) as HTMLInputElement).value).toBe("Ana Souza");
  });

  it("warns and offers to resend when the activation email could not be sent", async () => {
    const user = await renderLoaded([ANA]);
    await createdAfter(user, makeStudentCreated({ id: "aluno-novo", activationSent: false }));
    resendMock.mockResolvedValue(undefined);

    expect(await screen.findByText("Conta criada, mas não foi possível enviar o email de ativação.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reenviar ativação" }));

    expect(await screen.findByText("Email de ativação reenviado.")).toBeTruthy();
    expect(resendMock).toHaveBeenCalledWith("aluno-novo");
  });

  it("keeps the resend notice open when the email service is still unavailable", async () => {
    const user = await renderLoaded([ANA]);
    await createdAfter(user, makeStudentCreated({ activationSent: false }));
    resendMock.mockRejectedValue(new ApiError(503, "indisponível"));

    await user.click(await screen.findByRole("button", { name: "Reenviar ativação" }));

    expect(await screen.findByText("O envio ainda está indisponível. Tente novamente mais tarde.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reenviar ativação" })).toBeTruthy();
  });

  it("dismisses the activation notice with Escape", async () => {
    const user = await renderLoaded([ANA]);
    await createdAfter(user, makeStudentCreated());
    await screen.findByText(CREATED_NOTICE);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText(CREATED_NOTICE)).toBeNull());
  });

  it.each([
    { name: "Ab", email: "ab@example.com", message: "Informe um nome válido, sem números." },
    { name: "Maria Souza", email: "maria@example", message: "Informe um e-mail válido." },
  ])("rejects invalid data ($message)", async ({ name, email, message }) => {
    const user = await renderLoaded([ANA]);

    const dialog = await openCreate(user);
    await fillCreate(user, dialog, name, email);
    await submitCreate(user, dialog);

    expect((await within(dialog).findByRole("alert")).textContent).toContain(message);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("clears the validation error once the data is valid", async () => {
    const user = await renderLoaded([ANA]);
    createMock.mockResolvedValue(makeStudentCreated());

    const dialog = await openCreate(user);
    await fillCreate(user, dialog, "Ab", "ab@example.com");
    await submitCreate(user, dialog);
    await within(dialog).findByRole("alert");
    await user.type(within(dialog).getByRole("textbox", { name: /Nome completo/ }), "c Souza");
    await submitCreate(user, dialog);

    await closed();
    expect(createMock).toHaveBeenCalledWith({ nomeCompleto: "Abc Souza", email: "ab@example.com" });
  });

  it("shows the API error and keeps the typed data", async () => {
    const user = await renderLoaded([ANA]);
    createMock.mockRejectedValue(new ApiError(409, "E-mail já cadastrado"));

    const dialog = await openCreate(user);
    await fillCreate(user, dialog, "Maria Souza", "maria@example.com");
    await submitCreate(user, dialog);

    expect((await within(dialog).findByRole("alert")).textContent).toContain("E-mail já cadastrado");
    expect((within(dialog).getByRole("textbox", { name: /E-mail/ }) as HTMLInputElement).value).toBe("maria@example.com");
    expect((within(dialog).getByRole("button", { name: "Criar acesso" }) as HTMLButtonElement).disabled).toBe(false);
    expect(studentsMock).toHaveBeenCalledTimes(1);
  });

  it("uses the fallback message when the creation fails with an unknown error", async () => {
    const user = await renderLoaded([ANA]);
    createMock.mockRejectedValue("boom");

    const dialog = await openCreate(user);
    await fillCreate(user, dialog, "Maria Souza", "maria@example.com");
    await submitCreate(user, dialog);

    expect((await within(dialog).findByRole("alert")).textContent).toContain(CREATE_FALLBACK);
  });

  it("is busy while creating and cannot be dismissed", async () => {
    const user = await renderLoaded([ANA]);
    const pending = deferred<AdminStudentCreated>();
    createMock.mockReturnValue(pending.promise);

    const dialog = await openCreate(user);
    await fillCreate(user, dialog, "Maria Souza", "maria@example.com");
    await submitCreate(user, dialog);

    const working = await within(dialog).findByRole("button", { name: "Criando..." });
    expect((working as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: CREATE_LABEL })).toBeTruthy();

    pending.resolve(makeStudentCreated());
    await closed();
    expect(await screen.findByText(CREATED_NOTICE)).toBeTruthy();
  });
});
