import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminRecruitersView } from "@/components/admin/AdminViews";
import { adminApi } from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";
import type { AdminRecruiterCreated, AdminRecruiterDetail } from "@/types/admin";
import { deferred, makePaginated } from "./adminFixtures";
import {
  makeAdminRecruiter,
  makeAdminRecruiterCreated,
  makeAdminRecruiterDetail,
} from "./adminRecruiterFixtures";

vi.setConfig({ testTimeout: 15_000 });

vi.mock("@/lib/admin", () => ({
  adminApi: {
    recruiters: vi.fn(),
    recruiter: vi.fn(),
    createRecruiter: vi.fn(),
    recruiterAction: vi.fn(),
    deleteRecruiter: vi.fn(),
    resendActivation: vi.fn(),
  },
}));

const recruitersMock = vi.mocked(adminApi.recruiters);
const recruiterMock = vi.mocked(adminApi.recruiter);
const createMock = vi.mocked(adminApi.createRecruiter);
const actionMock = vi.mocked(adminApi.recruiterAction);
const deleteMock = vi.mocked(adminApi.deleteRecruiter);
const resendMock = vi.mocked(adminApi.resendActivation);

type User = ReturnType<typeof userEvent.setup>;

const SERVER_ERROR = 500;
const CREATE_TITLE = "Criar acesso de recrutador";
const DETAIL_TITLE = "Detalhes do recrutador";
const LOAD_FALLBACK = "Não foi possível carregar os dados.";
const DETAIL_FALLBACK = "Não foi possível carregar os detalhes.";
const ACTION_FALLBACK = "Não foi possível concluir a ação.";
const CREATE_FALLBACK = "Não foi possível criar o acesso.";
const ACTION_NOTICE = "Situação do recrutador atualizada.";
const CREATED_NOTICE = "Acesso de recrutador criado e email de ativação enviado.";
const NOT_SENT_NOTICE = "Conta criada, mas não foi possível enviar o email de ativação.";
const BLOCK_TITLE = "Bloquear recrutador?";
const DELETE_TITLE = "Excluir recrutador permanentemente?";
const DELETE_NOTICE = "Recrutador excluído permanentemente.";
const DELETE_FALLBACK = "Não foi possível excluir o recrutador.";
const SEARCH_LABEL = "Buscar nome ou empresa";

const CARLA = makeAdminRecruiter();
const DIEGO = makeAdminRecruiter({
  id: "rec-2",
  nomeCompleto: "Diego Alves",
  empresa: "Outra Empresa",
  cargo: "Gerente",
  cidade: "Ubá",
  uf: "MG",
  status: "BLOQUEADO",
  ultimoAcessoEm: null,
});

const VALID_FORM = {
  "Nome completo": "Paulo Ramos",
  "E-mail": "paulo@valetech.com.br",
  Empresa: "Vale Tech",
  Cargo: "Analista",
  Telefone: "(32) 99123-4567",
  Cidade: "Rio Pomba",
  UF: "mg",
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

async function renderList(items = [CARLA, DIEGO]) {
  recruitersMock.mockResolvedValue(makePaginated(items));
  const view = render(<AdminRecruitersView />);
  await screen.findByText(items[0].nomeCompleto);
  return view;
}

function rowButton(name: "Detalhes" | "Bloquear" | "Reativar" | "Excluir", index = 0) {
  return screen.getAllByRole("button", { name })[index];
}

function createDialog() {
  return screen.getByRole("dialog", { name: CREATE_TITLE });
}

async function openCreate(user: User) {
  await user.click(screen.getByRole("button", { name: CREATE_TITLE }));
  return screen.findByRole("dialog", { name: CREATE_TITLE });
}

async function fillCreateForm(user: User, values: Partial<typeof VALID_FORM> = {}) {
  const dialog = createDialog();
  const form = { ...VALID_FORM, ...values };
  for (const [label, value] of Object.entries(form)) {
    const field = within(dialog).getByLabelText(new RegExp(`^${label}`));
    await user.click(field);
    await user.paste(value);
  }
  return dialog;
}

async function submitCreate(user: User) {
  await user.click(within(createDialog()).getByRole("button", { name: "Criar acesso" }));
}

async function waitDialogClosed(name: string) {
  await waitFor(() => expect(screen.queryByRole("dialog", { name })).toBeNull());
}

describe("AdminRecruitersView list", () => {
  it("shows the skeleton and the create button while loading", () => {
    recruitersMock.mockReturnValue(new Promise(() => undefined));

    render(<AdminRecruitersView />);

    expect(screen.getByRole("heading", { name: "Recrutadores" })).toBeTruthy();
    expect(screen.getByRole("button", { name: CREATE_TITLE })).toBeTruthy();
    expect(screen.queryByText("Nenhum recrutador encontrado.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Detalhes" })).toBeNull();
  });

  it("lists active and blocked recruiters with the matching actions", async () => {
    await renderList();

    expect(screen.getByText("Vale Tech · Analista de RH · Rio Pomba/MG")).toBeTruthy();
    expect(screen.getByText("Outra Empresa · Gerente · Ubá/MG")).toBeTruthy();
    expect(screen.getByText(`Último acesso: ${formatUpdatedAt(CARLA.ultimoAcessoEm!)}`)).toBeTruthy();
    expect(screen.getByText("Último acesso: não informado")).toBeTruthy();
    expect(screen.getByText("Ativo")).toBeTruthy();
    expect(screen.getByText("Bloqueado")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Detalhes" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Bloquear" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Reativar" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Excluir" })).toHaveLength(1);
    expect(recruitersMock).toHaveBeenCalledWith(1, "", "");
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("shows the empty list message", async () => {
    recruitersMock.mockResolvedValue(makePaginated([]));

    render(<AdminRecruitersView />);

    expect(await screen.findByText("Nenhum recrutador encontrado.")).toBeTruthy();
  });

  it("paginates the list", async () => {
    const user = userEvent.setup();
    recruitersMock.mockImplementation((page) =>
      Promise.resolve(makePaginated([makeAdminRecruiter({ id: `rec-${page}`, nomeCompleto: `Pessoa ${page}` })], page, 2)),
    );

    render(<AdminRecruitersView />);
    await screen.findByText("Pessoa 1");
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Go to page 2" }));

    expect(await screen.findByText("Pessoa 2")).toBeTruthy();
    expect(recruitersMock).toHaveBeenLastCalledWith(2, "", "");
  });

  it("shows the API error and reloads on retry", async () => {
    const user = userEvent.setup();
    recruitersMock
      .mockRejectedValueOnce(new ApiError(SERVER_ERROR, "falha", { title: "Lista indisponível" }))
      .mockResolvedValueOnce(makePaginated([CARLA]));

    render(<AdminRecruitersView />);
    expect(await screen.findByText("Lista indisponível")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText(CARLA.nomeCompleto)).toBeTruthy();
    expect(recruitersMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback message for errors without a message", async () => {
    recruitersMock.mockRejectedValue("falha");

    render(<AdminRecruitersView />);

    expect(await screen.findByText(LOAD_FALLBACK)).toBeTruthy();
  });
});

describe("AdminRecruitersView search and filter", () => {
  it("searches by the trimmed term and returns to the first page", async () => {
    const user = userEvent.setup();
    recruitersMock.mockImplementation((page) =>
      Promise.resolve(makePaginated([makeAdminRecruiter({ id: `rec-${page}`, nomeCompleto: `Pessoa ${page}` })], page, 2)),
    );
    render(<AdminRecruitersView />);
    await screen.findByText("Pessoa 1");
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Go to page 2" }));
    await screen.findByText("Pessoa 2");

    await user.type(screen.getByLabelText(SEARCH_LABEL), "  vale  ");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(recruitersMock).toHaveBeenLastCalledWith(1, "vale", ""));
    expect(await screen.findByText("Pessoa 1")).toBeTruthy();
  });

  it("rejects invalid searches and clears the error once fixed", async () => {
    const user = userEvent.setup();
    await renderList();
    const callsBefore = recruitersMock.mock.calls.length;
    const field = screen.getByLabelText(SEARCH_LABEL);

    await user.click(field);
    await user.paste("😀");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText("Informe uma busca válida.")).toBeTruthy();
    expect(recruitersMock).toHaveBeenCalledTimes(callsBefore);
    await user.clear(field);
    await user.type(field, "ana{Enter}");

    await waitFor(() => expect(recruitersMock).toHaveBeenLastCalledWith(1, "ana", ""));
    expect(screen.queryByText("Informe uma busca válida.")).toBeNull();
  });

  it("filters by status", async () => {
    const user = userEvent.setup();
    await renderList();

    await user.click(screen.getByRole("combobox", { name: "Situação" }));
    await user.click(await screen.findByRole("option", { name: "Bloqueados" }));

    await waitFor(() => expect(recruitersMock).toHaveBeenLastCalledWith(1, "", "BLOQUEADO"));
    await user.click(screen.getByRole("combobox", { name: "Situação" }));
    await user.click(await screen.findByRole("option", { name: "Ativos" }));
    await waitFor(() => expect(recruitersMock).toHaveBeenLastCalledWith(1, "", "ATIVO"));
    await user.click(screen.getByRole("combobox", { name: "Situação" }));
    await user.click(await screen.findByRole("option", { name: "Todos" }));
    await waitFor(() => expect(recruitersMock).toHaveBeenLastCalledWith(1, "", ""));
  });
});

describe("AdminRecruitersView detail", () => {
  it("shows the skeleton and then the recruiter data", async () => {
    const user = userEvent.setup();
    await renderList();
    const pending = deferred<AdminRecruiterDetail>();
    recruiterMock.mockReturnValue(pending.promise);

    await user.click(rowButton("Detalhes"));
    const dialog = await screen.findByRole("dialog", { name: DETAIL_TITLE });
    expect(recruiterMock).toHaveBeenCalledWith("rec-1");
    expect(within(dialog).queryByRole("heading", { name: CARLA.nomeCompleto })).toBeNull();
    await act(async () => {
      pending.resolve(makeAdminRecruiterDetail());
    });

    expect(await within(dialog).findByRole("heading", { name: CARLA.nomeCompleto })).toBeTruthy();
    expect(within(dialog).getByText(/carla@valetech\.com\.br/)).toBeTruthy();
    expect(within(dialog).getByText(/Vale Tech/)).toBeTruthy();
    expect(within(dialog).getByText(/Analista de RH/)).toBeTruthy();
    expect(within(dialog).getByText(/32991234567/)).toBeTruthy();
    expect(within(dialog).getByText(/Rio Pomba\/MG/)).toBeTruthy();
    expect(within(dialog).getByText(formatUpdatedAt(CARLA.ultimoAcessoEm!), { exact: false })).toBeTruthy();
    expect(within(dialog).getByText("Ativo")).toBeTruthy();
  });

  it("shows a blocked recruiter without last access and closes the detail", async () => {
    const user = userEvent.setup();
    await renderList();
    recruiterMock.mockResolvedValue(
      makeAdminRecruiterDetail({ id: "rec-2", nomeCompleto: "Diego Alves", status: "BLOQUEADO", ultimoAcessoEm: null }),
    );

    await user.click(rowButton("Detalhes", 1));
    const dialog = await screen.findByRole("dialog", { name: DETAIL_TITLE });
    expect(await within(dialog).findByRole("heading", { name: "Diego Alves" })).toBeTruthy();
    expect(within(dialog).getByText("Não informado")).toBeTruthy();
    expect(within(dialog).getByText("Bloqueado")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));

    await waitDialogClosed(DETAIL_TITLE);
  });

  it("shows the API error in the detail and retries", async () => {
    const user = userEvent.setup();
    await renderList();
    recruiterMock
      .mockRejectedValueOnce(new ApiError(SERVER_ERROR, "falha", { title: "Detalhe indisponível" }))
      .mockResolvedValueOnce(makeAdminRecruiterDetail());

    await user.click(rowButton("Detalhes"));
    const dialog = await screen.findByRole("dialog", { name: DETAIL_TITLE });
    expect(await within(dialog).findByText("Detalhe indisponível")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Tentar novamente" }));

    expect(await within(dialog).findByRole("heading", { name: CARLA.nomeCompleto })).toBeTruthy();
    expect(recruiterMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback message when the detail fails without a message", async () => {
    const user = userEvent.setup();
    await renderList();
    recruiterMock.mockRejectedValue("falha");

    await user.click(rowButton("Detalhes"));

    expect(await screen.findByText(DETAIL_FALLBACK)).toBeTruthy();
  });

  /** Opens the first recruiter (left pending), closes it and opens the second one, which loads. */
  async function replaceDetail(user: User) {
    await renderList();
    const stale = deferred<AdminRecruiterDetail>();
    recruiterMock
      .mockReturnValueOnce(stale.promise)
      .mockResolvedValueOnce(
        makeAdminRecruiterDetail({ id: "rec-2", nomeCompleto: "Diego Alves", status: "BLOQUEADO", ultimoAcessoEm: null }),
      );
    await user.click(rowButton("Detalhes"));
    await user.click(within(await screen.findByRole("dialog", { name: DETAIL_TITLE })).getByRole("button", { name: "Fechar" }));
    await waitDialogClosed(DETAIL_TITLE);
    await user.click(rowButton("Detalhes", 1));
    const dialog = await screen.findByRole("dialog", { name: DETAIL_TITLE });
    await within(dialog).findByRole("heading", { name: "Diego Alves" });
    return { stale, dialog };
  }

  it("ignores the response of a detail replaced by another one before it finished", async () => {
    const user = userEvent.setup();
    const { stale, dialog } = await replaceDetail(user);

    await act(async () => {
      stale.resolve(makeAdminRecruiterDetail());
    });

    expect(within(dialog).queryByRole("heading", { name: CARLA.nomeCompleto })).toBeNull();
    expect(within(dialog).getByRole("heading", { name: "Diego Alves" })).toBeTruthy();
  });

  it("ignores the error of a detail replaced by another one before it finished", async () => {
    const user = userEvent.setup();
    const { stale, dialog } = await replaceDetail(user);

    await act(async () => {
      stale.reject(new ApiError(SERVER_ERROR, "falha", { title: "Falha tardia" }));
    });

    expect(within(dialog).queryByText("Falha tardia")).toBeNull();
    expect(within(dialog).getByRole("heading", { name: "Diego Alves" })).toBeTruthy();
  });
});

describe("AdminRecruitersView block and reactivate", () => {
  it("blocks an active recruiter after confirmation and reloads the list", async () => {
    const user = userEvent.setup();
    await renderList();
    actionMock.mockResolvedValue(undefined);

    await user.click(rowButton("Bloquear"));
    const confirm = await screen.findByRole("dialog", { name: BLOCK_TITLE });
    expect(within(confirm).getByText("Deseja bloquear Carla Mendes?")).toBeTruthy();
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText(ACTION_NOTICE)).toBeTruthy();
    expect(actionMock).toHaveBeenCalledWith("rec-1", "bloquear");
    expect(recruitersMock).toHaveBeenCalledTimes(2);
    await waitDialogClosed(BLOCK_TITLE);
  });

  it("reactivates a blocked recruiter after confirmation", async () => {
    const user = userEvent.setup();
    await renderList();
    actionMock.mockResolvedValue(undefined);

    await user.click(rowButton("Reativar"));
    const confirm = await screen.findByRole("dialog", { name: "Reativar recrutador?" });
    expect(within(confirm).getByText("Deseja reativar Diego Alves?")).toBeTruthy();
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText(ACTION_NOTICE)).toBeTruthy();
    expect(actionMock).toHaveBeenCalledWith("rec-2", "reativar");
  });

  it("cancels the confirmation without calling the API", async () => {
    const user = userEvent.setup();
    await renderList();

    await user.click(rowButton("Bloquear"));
    const confirm = await screen.findByRole("dialog", { name: BLOCK_TITLE });
    await user.click(within(confirm).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(actionMock).not.toHaveBeenCalled();
    expect(screen.queryByText(ACTION_NOTICE)).toBeNull();
  });

  it("shows the API error and clears it on cancel", async () => {
    const user = userEvent.setup();
    await renderList();
    actionMock.mockRejectedValue(new ApiError(SERVER_ERROR, "falha", { title: "Ação recusada" }));

    await user.click(rowButton("Bloquear"));
    const confirm = await screen.findByRole("dialog", { name: BLOCK_TITLE });
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));
    expect(await within(confirm).findByText("Ação recusada")).toBeTruthy();
    expect(screen.queryByText(ACTION_NOTICE)).toBeNull();
    await user.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(rowButton("Bloquear"));

    const reopened = await screen.findByRole("dialog", { name: BLOCK_TITLE });
    expect(within(reopened).queryByText("Ação recusada")).toBeNull();
  });

  it("uses the fallback message when the action fails without a message", async () => {
    const user = userEvent.setup();
    await renderList();
    actionMock.mockRejectedValue("falha");

    await user.click(rowButton("Bloquear"));
    const confirm = await screen.findByRole("dialog", { name: BLOCK_TITLE });
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));

    expect(await within(confirm).findByText(ACTION_FALLBACK)).toBeTruthy();
  });

  it("disables the buttons while the action is in progress", async () => {
    const user = userEvent.setup();
    await renderList();
    const pending = deferred<undefined>();
    actionMock.mockReturnValue(pending.promise);

    await user.click(rowButton("Bloquear"));
    const confirm = await screen.findByRole("dialog", { name: BLOCK_TITLE });
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));

    const processing = await within(confirm).findByRole("button", { name: "Processando..." });
    expect((processing as HTMLButtonElement).disabled).toBe(true);
    expect(actionMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(undefined);
    });
    expect(await screen.findByText(ACTION_NOTICE)).toBeTruthy();
  });

  it("ignores a confirmation fired after the dialog was cancelled", async () => {
    const user = userEvent.setup();
    await renderList();
    await user.click(rowButton("Bloquear"));
    const confirm = await screen.findByRole("dialog", { name: BLOCK_TITLE });
    const confirmButton = within(confirm).getByRole("button", { name: "Confirmar" });

    fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(confirmButton);
    await act(async () => undefined);

    expect(within(confirm).queryByRole("alert")).toBeNull();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(actionMock).not.toHaveBeenCalled();
    expect(screen.queryByText(ACTION_NOTICE)).toBeNull();
  });

  it("dismisses the status updated notice with Escape", async () => {
    const user = userEvent.setup();
    await renderList();
    actionMock.mockResolvedValue(undefined);
    await user.click(rowButton("Bloquear"));
    await user.click(within(await screen.findByRole("dialog", { name: BLOCK_TITLE })).getByRole("button", { name: "Confirmar" }));
    await screen.findByText(ACTION_NOTICE);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText(ACTION_NOTICE)).toBeNull());
  });
});

describe("AdminRecruitersView permanent deletion", () => {
  async function openDeleteDialog(user: User) {
    await user.click(rowButton("Excluir"));
    return screen.findByRole("dialog", { name: DELETE_TITLE });
  }

  it("only offers deletion for blocked recruiters", async () => {
    await renderList([CARLA]);

    expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
  });

  it("deletes a blocked recruiter after confirmation and reloads the list", async () => {
    const user = userEvent.setup();
    await renderList();
    recruitersMock.mockResolvedValue(makePaginated([CARLA]));
    deleteMock.mockResolvedValue(undefined);

    const dialog = await openDeleteDialog(user);
    expect(within(dialog).getByText("A exclusão de Diego Alves é permanente e não poderá ser desfeita.")).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText(DELETE_NOTICE)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Diego Alves")).toBeNull());
    expect(deleteMock).toHaveBeenCalledWith("rec-2");
    expect(recruitersMock).toHaveBeenCalledTimes(2);
    expect(recruitersMock).toHaveBeenLastCalledWith(1, "", "");
  });

  it("goes back one page when the only recruiter of a later page is deleted", async () => {
    const user = userEvent.setup();
    recruitersMock.mockResolvedValue(makePaginated([CARLA], 1, 2));
    render(<AdminRecruitersView />);
    await screen.findByText("Carla Mendes");
    recruitersMock.mockResolvedValue(makePaginated([DIEGO], 2, 2));
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: /page 2/i }));
    await screen.findByText("Diego Alves");
    recruitersMock.mockResolvedValue(makePaginated([CARLA], 1, 1));
    deleteMock.mockResolvedValue(undefined);

    const dialog = await openDeleteDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Carla Mendes")).toBeTruthy();
    expect(recruitersMock).toHaveBeenLastCalledWith(1, "", "");
    expect(deleteMock).toHaveBeenCalledWith("rec-2");
  });

  it("cancels without deleting", async () => {
    const user = userEvent.setup();
    await renderList();

    const dialog = await openDeleteDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitDialogClosed(DELETE_TITLE);
    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getByText("Diego Alves")).toBeTruthy();
  });

  it("shows the API error inside the dialog and keeps the recruiter", async () => {
    const user = userEvent.setup();
    await renderList();
    deleteMock.mockRejectedValue(new ApiError(409, "Recrutador precisa estar bloqueado"));

    const dialog = await openDeleteDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("Recrutador precisa estar bloqueado");
    expect(screen.queryByText(DELETE_NOTICE)).toBeNull();
    expect(recruitersMock).toHaveBeenCalledTimes(1);
  });

  it("uses the fallback message when the deletion fails with an unknown error", async () => {
    const user = userEvent.setup();
    await renderList();
    deleteMock.mockRejectedValue("boom");

    const dialog = await openDeleteDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain(DELETE_FALLBACK);
  });

  it("ignores a confirmation fired after the dialog was cancelled", async () => {
    const user = userEvent.setup();
    await renderList();
    const dialog = await openDeleteDialog(user);
    const confirmButton = within(dialog).getByRole("button", { name: "Confirmar" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(confirmButton);
    await act(async () => undefined);

    await waitDialogClosed(DELETE_TITLE);
    expect(deleteMock).not.toHaveBeenCalled();
  });
});

describe("AdminRecruitersView creation", () => {
  it("opens the form with empty fields and cancels", async () => {
    const user = userEvent.setup();
    await renderList();

    const dialog = await openCreate(user);
    for (const label of Object.keys(VALID_FORM)) {
      expect((within(dialog).getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement).value).toBe("");
    }
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitDialogClosed(CREATE_TITLE);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("closes the form with Escape", async () => {
    const user = userEvent.setup();
    await renderList();
    await openCreate(user);

    await user.keyboard("{Escape}");

    await waitDialogClosed(CREATE_TITLE);
  });

  it("strips invalid characters and limits the UF while typing", async () => {
    const user = userEvent.setup();
    await renderList();
    const dialog = await openCreate(user);

    await user.type(within(dialog).getByLabelText(/^Nome completo/), "João 123 Silva");
    await user.type(within(dialog).getByLabelText(/^Cidade/), "Ubá 45");
    await user.type(within(dialog).getByLabelText(/^UF/), "mgx");
    await user.type(within(dialog).getByLabelText(/^Telefone/), "(32) 9");
    await user.type(within(dialog).getByLabelText(/^Empresa/), "Vale 2");

    expect((within(dialog).getByLabelText(/^Nome completo/) as HTMLInputElement).value).toBe("João  Silva");
    expect((within(dialog).getByLabelText(/^Cidade/) as HTMLInputElement).value).toBe("Ubá ");
    expect((within(dialog).getByLabelText(/^UF/) as HTMLInputElement).value).toBe("MG");
    expect((within(dialog).getByLabelText(/^Telefone/) as HTMLInputElement).value).toBe("(32) 9");
    expect((within(dialog).getByLabelText(/^Empresa/) as HTMLInputElement).value).toBe("Vale 2");
  });

  it.each([
    ["Nome completo", "Al", "Informe um nome válido, sem números."],
    ["E-mail", "paulo@valetech", "Informe um e-mail válido."],
    ["Empresa", "V", "Informe uma empresa válido."],
    ["Cargo", "A", "Informe um cargo válido."],
    ["Telefone", "123", "Informe um telefone brasileiro válido."],
    ["Cidade", "R", "Informe uma cidade válida, sem números."],
    ["UF", "XX", "Selecione uma UF válida."],
  ])("rejects the invalid %s field without calling the API", async (label, value, message) => {
    const user = userEvent.setup();
    await renderList();
    await openCreate(user);
    await fillCreateForm(user, { [label]: value });

    await submitCreate(user);

    expect(await within(createDialog()).findByText(message)).toBeTruthy();
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates the access with normalized data, closes the form and reloads the list", async () => {
    const user = userEvent.setup();
    await renderList();
    createMock.mockResolvedValue(makeAdminRecruiterCreated());
    await openCreate(user);
    await fillCreateForm(user, { "Nome completo": "  Paulo   Ramos ", Telefone: "+55 (32) 99123-4567" });

    await submitCreate(user);

    expect(await screen.findByText(CREATED_NOTICE)).toBeTruthy();
    expect(createMock).toHaveBeenCalledWith({
      nomeCompleto: "Paulo Ramos",
      email: "paulo@valetech.com.br",
      empresa: "Vale Tech",
      cargo: "Analista",
      telefone: "32991234567",
      cidade: "Rio Pomba",
      uf: "MG",
    });
    expect(recruitersMock).toHaveBeenCalledTimes(2);
    await waitDialogClosed(CREATE_TITLE);
    expect(screen.queryByRole("button", { name: "Reenviar ativação" })).toBeNull();
    const reopened = await openCreate(user);
    expect((within(reopened).getByLabelText(/^Nome completo/) as HTMLInputElement).value).toBe("");
  });

  it("warns when the activation email was not sent and allows resending", async () => {
    const user = userEvent.setup();
    await renderList();
    createMock.mockResolvedValue(makeAdminRecruiterCreated({ activationSent: false }));
    resendMock.mockResolvedValue(undefined);
    await openCreate(user);
    await fillCreateForm(user);
    await submitCreate(user);

    expect(await screen.findByText(NOT_SENT_NOTICE)).toBeTruthy();
    await waitDialogClosed(CREATE_TITLE);
    await user.click(screen.getByRole("button", { name: "Reenviar ativação" }));

    expect(await screen.findByText("Email de ativação reenviado.")).toBeTruthy();
    expect(resendMock).toHaveBeenCalledWith("rec-new");
  });

  it("dismisses the activation notice with Escape", async () => {
    const user = userEvent.setup();
    await renderList();
    createMock.mockResolvedValue(makeAdminRecruiterCreated());
    await openCreate(user);
    await fillCreateForm(user);
    await submitCreate(user);
    await screen.findByText(CREATED_NOTICE);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText(CREATED_NOTICE)).toBeNull());
  });

  it("shows the API error in the form and keeps the typed data", async () => {
    const user = userEvent.setup();
    await renderList();
    createMock.mockRejectedValue(new ApiError(SERVER_ERROR, "falha", { title: "E-mail já cadastrado" }));
    await openCreate(user);
    await fillCreateForm(user);

    await submitCreate(user);

    expect(await within(createDialog()).findByText("E-mail já cadastrado")).toBeTruthy();
    expect((within(createDialog()).getByLabelText(/^E-mail/) as HTMLInputElement).value).toBe("paulo@valetech.com.br");
    expect(recruitersMock).toHaveBeenCalledTimes(1);
  });

  it("uses the fallback message when the creation fails without a message", async () => {
    const user = userEvent.setup();
    await renderList();
    createMock.mockRejectedValue("falha");
    await openCreate(user);
    await fillCreateForm(user);

    await submitCreate(user);

    expect(await within(createDialog()).findByText(CREATE_FALLBACK)).toBeTruthy();
  });

  it("prevents duplicate submissions and dismissal while creating", async () => {
    const user = userEvent.setup();
    await renderList();
    const pending = deferred<AdminRecruiterCreated>();
    createMock.mockReturnValue(pending.promise);
    await openCreate(user);
    const dialog = await fillCreateForm(user);

    await submitCreate(user);

    const creating = await within(dialog).findByRole("button", { name: "Criando..." });
    expect((creating as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(creating.closest("form")!);
    await user.keyboard("{Escape}");
    expect(createDialog()).toBeTruthy();
    expect(createMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      pending.resolve(makeAdminRecruiterCreated());
    });
    expect(await screen.findByText(CREATED_NOTICE)).toBeTruthy();
  });
});
