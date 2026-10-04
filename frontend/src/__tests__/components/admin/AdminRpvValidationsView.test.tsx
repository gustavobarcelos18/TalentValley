import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminRpvValidationsView } from "@/components/admin/AdminViews";
import { adminApi } from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { formatDate, formatUpdatedAt } from "@/lib/format";
import type { RpvValidationDetail } from "@/types/admin";
import { deferred, makePaginated } from "./adminFixtures";
import { makeRpvValidation, makeRpvValidationDetail } from "./adminRecruiterFixtures";

vi.setConfig({ testTimeout: 15_000 });

vi.mock("@/lib/admin", () => ({
  adminApi: {
    validations: vi.fn(),
    validation: vi.fn(),
    validationAction: vi.fn(),
  },
}));

const validationsMock = vi.mocked(adminApi.validations);
const validationMock = vi.mocked(adminApi.validation);
const actionMock = vi.mocked(adminApi.validationAction);

type User = ReturnType<typeof userEvent.setup>;

const SERVER_ERROR = 500;
const DETAIL_TITLE = "Validação de formação RPV";
const APPROVE_TITLE = "Aprovar formação?";
const LOAD_FALLBACK = "Não foi possível carregar os dados.";
const DETAIL_FALLBACK = "Não foi possível carregar a validação.";
const ACTION_FALLBACK = "Não foi possível concluir a validação.";
const APPROVED_NOTICE = "Formação aprovada.";

const ANA = makeRpvValidation();
const BRUNO = makeRpvValidation({
  formacaoId: "for-2",
  alunoNome: "Bruno Reis",
  alunoAtivo: false,
  tipo: "GRADUACAO",
  nome: "Sistemas de Informação",
  possuiCertificado: false,
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

function detailDialog() {
  return screen.getByRole("dialog", { name: DETAIL_TITLE });
}

async function renderList(items = [ANA, BRUNO]) {
  validationsMock.mockResolvedValue(makePaginated(items));
  const view = render(<AdminRpvValidationsView />);
  await screen.findByText(items[0].nome);
  return view;
}

async function openDetail(user: User, detail = makeRpvValidationDetail()) {
  validationMock.mockResolvedValue(detail);
  await user.click(screen.getAllByRole("button", { name: "Analisar" })[0]);
  await screen.findByRole("heading", { name: detail.formacao.nome });
}

async function startAction(user: User, label: "Aprovar" | "Rejeitar") {
  await user.click(within(detailDialog()).getByRole("button", { name: label }));
  return screen.findByRole("dialog", {
    name: label === "Aprovar" ? APPROVE_TITLE : "Rejeitar formação?",
  });
}

async function openPendingDetail(user: User) {
  const pending = deferred<RpvValidationDetail>();
  validationMock.mockReturnValue(pending.promise);
  await user.click(screen.getAllByRole("button", { name: "Analisar" })[0]);
  await screen.findByRole("dialog", { name: DETAIL_TITLE });
  return pending;
}

async function closeDetail(user: User) {
  await user.click(within(detailDialog()).getByRole("button", { name: "Fechar" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: DETAIL_TITLE })).toBeNull());
}

describe("AdminRpvValidationsView list", () => {
  it("shows the skeleton while loading", () => {
    validationsMock.mockReturnValue(new Promise(() => undefined));

    render(<AdminRpvValidationsView />);

    expect(screen.getByRole("heading", { name: "Validações RPV" })).toBeTruthy();
    expect(screen.queryByText("Não há validações RPV pendentes.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Analisar" })).toBeNull();
  });

  it("lists the pending formations with the student status and certificate", async () => {
    await renderList();

    expect(screen.getByText("Técnico em Informática")).toBeTruthy();
    expect(screen.getByText(/Ana Lima · Rio Pomba Valley · Técnico/)).toBeTruthy();
    expect(screen.getByText(/Bruno Reis · Rio Pomba Valley · Graduação/)).toBeTruthy();
    expect(
      screen.getByText(new RegExp(`Atualizado ${formatUpdatedAt(ANA.atualizadoEm)}.*Certificado disponível`)),
    ).toBeTruthy();
    expect(screen.getByText(/Sem certificado/)).toBeTruthy();
    expect(screen.getByText("Ativo")).toBeTruthy();
    expect(screen.getByText("Bloqueado")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Analisar" })).toHaveLength(2);
    expect(validationsMock).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("shows the empty list message", async () => {
    validationsMock.mockResolvedValue(makePaginated([]));

    render(<AdminRpvValidationsView />);

    expect(await screen.findByText("Não há validações RPV pendentes.")).toBeTruthy();
  });

  it("paginates the list", async () => {
    const user = userEvent.setup();
    validationsMock.mockImplementation((page) =>
      Promise.resolve(
        makePaginated([makeRpvValidation({ formacaoId: `for-${page}`, nome: `Formação ${page}` })], page, 2),
      ),
    );

    render(<AdminRpvValidationsView />);
    await screen.findByText("Formação 1");
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Go to page 2" }));

    expect(await screen.findByText("Formação 2")).toBeTruthy();
    expect(validationsMock).toHaveBeenLastCalledWith(2);
  });

  it("shows the API error and reloads on retry", async () => {
    const user = userEvent.setup();
    validationsMock
      .mockRejectedValueOnce(new ApiError(SERVER_ERROR, "falha", { title: "Serviço fora do ar" }))
      .mockResolvedValueOnce(makePaginated([ANA]));

    render(<AdminRpvValidationsView />);
    expect(await screen.findByText("Serviço fora do ar")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText(ANA.nome)).toBeTruthy();
    expect(validationsMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback message for errors without a message", async () => {
    validationsMock.mockRejectedValue("falha");

    render(<AdminRpvValidationsView />);

    expect(await screen.findByText(LOAD_FALLBACK)).toBeTruthy();
  });
});

describe("AdminRpvValidationsView detail", () => {
  it("shows the detail skeleton and then the data of the completed formation", async () => {
    const user = userEvent.setup();
    await renderList();
    const pending = await openPendingDetail(user);
    const dialog = detailDialog();

    expect(validationMock).toHaveBeenCalledWith("for-1");
    expect(within(dialog).queryByRole("button", { name: "Aprovar" })).toBeNull();
    await act(async () => {
      pending.resolve(makeRpvValidationDetail());
    });

    expect(await within(dialog).findByRole("heading", { name: "Técnico em Informática" })).toBeTruthy();
    expect(within(dialog).getByText(/Ana Lima/)).toBeTruthy();
    expect(within(dialog).getByText("Ativo")).toBeTruthy();
    expect(within(dialog).getByText(/Rio Pomba Valley/)).toBeTruthy();
    expect(within(dialog).getByText(/Técnico$/)).toBeTruthy();
    expect(
      within(dialog).getByText(new RegExp(`${formatDate("2024-02-01")} — ${formatDate("2025-12-15")}`)),
    ).toBeTruthy();
    expect(within(dialog).getByText(/800/)).toBeTruthy();
    expect(within(dialog).getByText(/Concluído/)).toBeTruthy();
    expect(within(dialog).getByText(/PENDENTE/)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Abrir certificado" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Aprovar" })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Rejeitar" })).toBeTruthy();
  });

  it("shows an open period, missing workload, blocked student and no certificate", async () => {
    const user = userEvent.setup();
    await renderList();

    await openDetail(
      user,
      makeRpvValidationDetail({
        aluno: { ativo: false },
        formacao: { dataFim: null, cargaHoraria: null, possuiCertificado: false },
      }),
    );

    const dialog = detailDialog();
    expect(within(dialog).getByText(formatDate("2024-02-01"))).toBeTruthy();
    expect(within(dialog).getByText("Não informada")).toBeTruthy();
    expect(within(dialog).getByText("Bloqueado")).toBeTruthy();
    expect(within(dialog).getByText("Não há certificado disponível para esta formação.")).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Abrir certificado" })).toBeNull();
  });

  it("closes the detail with the Fechar button", async () => {
    const user = userEvent.setup();
    await renderList();
    await openDetail(user);

    await closeDetail(user);

    expect(screen.queryByRole("dialog", { name: DETAIL_TITLE })).toBeNull();
  });

  it("shows the API error in the detail and retries", async () => {
    const user = userEvent.setup();
    await renderList();
    validationMock
      .mockRejectedValueOnce(new ApiError(SERVER_ERROR, "falha", { title: "Validação indisponível" }))
      .mockResolvedValueOnce(makeRpvValidationDetail());

    await user.click(screen.getAllByRole("button", { name: "Analisar" })[0]);
    const dialog = await screen.findByRole("dialog", { name: DETAIL_TITLE });
    expect(await within(dialog).findByText("Validação indisponível")).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Aprovar" })).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Tentar novamente" }));

    expect(await within(dialog).findByRole("heading", { name: "Técnico em Informática" })).toBeTruthy();
    expect(validationMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback message when the detail fails without a message", async () => {
    const user = userEvent.setup();
    await renderList();
    validationMock.mockRejectedValue("falha");

    await user.click(screen.getAllByRole("button", { name: "Analisar" })[0]);

    expect(await screen.findByText(DETAIL_FALLBACK)).toBeTruthy();
  });

  /** Opens the first formation (left pending), closes it and opens the second one, which loads. */
  async function replaceDetail(user: User) {
    await renderList();
    const stale = await openPendingDetail(user);
    await closeDetail(user);
    validationMock.mockResolvedValue(
      makeRpvValidationDetail({
        formacaoId: "for-2",
        aluno: { nomeCompleto: "Bruno Reis" },
        formacao: { nome: "Sistemas de Informação" },
      }),
    );
    await user.click(screen.getAllByRole("button", { name: "Analisar" })[1]);
    await screen.findByRole("heading", { name: "Sistemas de Informação" });
    return stale;
  }

  it("ignores the response of a detail replaced by another one before it finished", async () => {
    const user = userEvent.setup();
    const stale = await replaceDetail(user);

    await act(async () => {
      stale.resolve(makeRpvValidationDetail());
    });

    expect(within(detailDialog()).queryByRole("heading", { name: "Técnico em Informática" })).toBeNull();
    expect(within(detailDialog()).getByRole("heading", { name: "Sistemas de Informação" })).toBeTruthy();
  });

  it("ignores the error of a detail replaced by another one before it finished", async () => {
    const user = userEvent.setup();
    const stale = await replaceDetail(user);

    await act(async () => {
      stale.reject(new ApiError(SERVER_ERROR, "falha", { title: "Falha tardia" }));
    });

    expect(within(detailDialog()).queryByText("Falha tardia")).toBeNull();
    expect(within(detailDialog()).getByRole("heading", { name: "Sistemas de Informação" })).toBeTruthy();
  });

  // The unmounted state update is a silent no-op in React 19, so these cases only exercise the
  // late-settle path; a regression would surface as an unhandled rejection or a thrown error.
  it("settles a detail response that arrives after the view is unmounted without errors", async () => {
    const user = userEvent.setup();
    const view = await renderList([ANA]);
    const pending = await openPendingDetail(user);
    view.unmount();

    await act(async () => {
      pending.resolve(makeRpvValidationDetail());
    });

    expect(validationMock).toHaveBeenCalledTimes(1);
  });

  it("settles a detail failure that arrives after the view is unmounted without errors", async () => {
    const user = userEvent.setup();
    const view = await renderList([ANA]);
    const pending = await openPendingDetail(user);
    view.unmount();

    await act(async () => {
      pending.reject(new Error("desmontado"));
    });

    expect(validationMock).toHaveBeenCalledTimes(1);
  });
});

describe("AdminRpvValidationsView approve and reject", () => {
  it("approves the formation after confirmation and reloads the list", async () => {
    const user = userEvent.setup();
    await renderList();
    await openDetail(user);
    actionMock.mockResolvedValue(undefined);
    validationsMock.mockResolvedValue(makePaginated([BRUNO]));

    const confirm = await startAction(user, "Aprovar");
    expect(within(confirm).getByText("A formação será marcada como verificada pelo Rio Pomba Valley.")).toBeTruthy();
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText(APPROVED_NOTICE)).toBeTruthy();
    expect(actionMock).toHaveBeenCalledWith("for-1", "aprovar");
    expect(await screen.findByText(/Bruno Reis/)).toBeTruthy();
    expect(screen.queryByText(/Ana Lima ·/)).toBeNull();
    expect(validationsMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: DETAIL_TITLE })).toBeNull());
  });

  it("rejects the formation after confirmation", async () => {
    const user = userEvent.setup();
    await renderList();
    await openDetail(user);
    actionMock.mockResolvedValue(undefined);

    const confirm = await startAction(user, "Rejeitar");
    expect(within(confirm).getByText("A formação será marcada como rejeitada.")).toBeTruthy();
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText("Formação rejeitada.")).toBeTruthy();
    expect(actionMock).toHaveBeenCalledWith("for-1", "rejeitar");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: DETAIL_TITLE })).toBeNull());
  });

  it("cancels the confirmation without calling the API and keeps the detail open", async () => {
    const user = userEvent.setup();
    await renderList();
    await openDetail(user);

    const confirm = await startAction(user, "Aprovar");
    await user.click(within(confirm).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: /formação\?$/ })).toBeNull());
    expect(actionMock).not.toHaveBeenCalled();
    expect(detailDialog()).toBeTruthy();
  });

  it("ignores a confirmation fired after the dialog was cancelled", async () => {
    const user = userEvent.setup();
    await renderList();
    await openDetail(user);
    const confirm = await startAction(user, "Aprovar");
    const confirmButton = within(confirm).getByRole("button", { name: "Confirmar" });

    fireEvent.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    fireEvent.click(confirmButton);

    await waitFor(() => expect(screen.queryByRole("dialog", { name: /formação\?$/ })).toBeNull());
    expect(actionMock).not.toHaveBeenCalled();
    expect(screen.queryByText(APPROVED_NOTICE)).toBeNull();
  });

  it("dismisses the result notice with Escape", async () => {
    const user = userEvent.setup();
    await renderList();
    await openDetail(user);
    actionMock.mockResolvedValue(undefined);
    const confirm = await startAction(user, "Aprovar");
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));
    await screen.findByText(APPROVED_NOTICE);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText(APPROVED_NOTICE)).toBeNull());
  });

  it("shows the API error in the confirmation and allows finishing later", async () => {
    const user = userEvent.setup();
    await renderList();
    await openDetail(user);
    actionMock
      .mockRejectedValueOnce(new ApiError(SERVER_ERROR, "falha", { title: "Formação já processada" }))
      .mockResolvedValueOnce(undefined);

    const confirm = await startAction(user, "Aprovar");
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));
    expect(await within(confirm).findByText("Formação já processada")).toBeTruthy();
    expect(screen.queryByText(APPROVED_NOTICE)).toBeNull();
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));

    expect(await screen.findByText(APPROVED_NOTICE)).toBeTruthy();
    expect(actionMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback message when the action fails without a message", async () => {
    const user = userEvent.setup();
    await renderList();
    await openDetail(user);
    actionMock.mockRejectedValue("falha");

    const confirm = await startAction(user, "Rejeitar");
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));

    expect(await within(confirm).findByText(ACTION_FALLBACK)).toBeTruthy();
  });

  it("blocks the buttons while the action is in progress", async () => {
    const user = userEvent.setup();
    await renderList();
    await openDetail(user);
    const pending = deferred<undefined>();
    actionMock.mockReturnValue(pending.promise);

    const confirm = await startAction(user, "Aprovar");
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));

    const processing = await within(confirm).findByRole("button", { name: "Processando..." });
    expect((processing as HTMLButtonElement).disabled).toBe(true);
    expect((within(confirm).getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(confirm, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: APPROVE_TITLE })).toBeTruthy();
    await act(async () => {
      pending.resolve(undefined);
    });
    expect(await screen.findByText(APPROVED_NOTICE)).toBeTruthy();
  });

  it("goes back one page when the only formation of the current page is processed", async () => {
    const user = userEvent.setup();
    validationsMock.mockImplementation((page) =>
      Promise.resolve(
        page === 1
          ? makePaginated([ANA, BRUNO], 1, 2)
          : makePaginated([makeRpvValidation({ formacaoId: "for-9", nome: "Formação da página 2" })], 2, 2),
      ),
    );
    render(<AdminRpvValidationsView />);
    await screen.findByText(ANA.nome);
    await user.click(within(screen.getByRole("navigation")).getByRole("button", { name: "Go to page 2" }));
    await screen.findByText("Formação da página 2");
    await openDetail(user, makeRpvValidationDetail({ formacaoId: "for-9", formacao: { nome: "Formação da página 2" } }));
    actionMock.mockResolvedValue(undefined);

    const confirm = await startAction(user, "Aprovar");
    await user.click(within(confirm).getByRole("button", { name: "Confirmar" }));

    await screen.findByText(APPROVED_NOTICE);
    await waitFor(() => expect(validationsMock).toHaveBeenLastCalledWith(1));
    expect(actionMock).toHaveBeenCalledWith("for-9", "aprovar");
    expect(await screen.findByText(/Ana Lima ·/)).toBeTruthy();
  });
});
