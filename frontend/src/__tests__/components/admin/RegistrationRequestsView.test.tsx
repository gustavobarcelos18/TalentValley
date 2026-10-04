import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RegistrationRequestsView } from "@/components/admin/RegistrationRequestsView";
import { adminApi } from "@/lib/admin";
import { ApiError } from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";
import type {
  AdminRegistrationRequest,
  AdminRegistrationRequestDetail,
  PaginatedResponse,
} from "@/types/admin";
import {
  makeRecruiterRequest,
  makeRecruiterRequestDetail,
  makeStudentRequest,
  makeStudentRequestDetail,
} from "./adminDetailFixtures";
import { deferred, makePaginated, type Deferred } from "./adminFixtures";

vi.setConfig({ testTimeout: 15_000 });

vi.mock("@/lib/admin", () => ({
  adminApi: {
    registrationRequests: vi.fn(),
    registrationRequest: vi.fn(),
    approveRegistration: vi.fn(),
    rejectRegistration: vi.fn(),
    resendActivation: vi.fn(),
  },
}));

const listMock = vi.mocked(adminApi.registrationRequests);
const detailMock = vi.mocked(adminApi.registrationRequest);
const approveMock = vi.mocked(adminApi.approveRegistration);
const rejectMock = vi.mocked(adminApi.rejectRegistration);
const resendMock = vi.mocked(adminApi.resendActivation);

const SERVER_ERROR = 500;
const LIST_FALLBACK = "Não foi possível carregar as solicitações.";
const DETAIL_FALLBACK = "Não foi possível abrir a solicitação.";
const APPROVE_FALLBACK = "Não foi possível aprovar o cadastro.";
const REJECT_FALLBACK = "Não foi possível rejeitar a solicitação.";
const DETAIL_TITLE = "Detalhes da solicitação";
const REJECT_TITLE = "Rejeitar solicitação";
const EMPTY_TEXT = "Nenhuma solicitação encontrada para os filtros selecionados.";
const APPROVED_NOTICE = "Cadastro aprovado e email de ativação enviado.";
const REJECTED_NOTICE = "Solicitação rejeitada.";
const APPROVE_LABEL = "Aprovar cadastro";
const REJECT_LABEL = "Rejeitar cadastro";
const VIEW_DETAILS = "Ver detalhes";
const REASON_LABEL = "Motivo (opcional)";
const NOT_SENT_NOTICE = "Conta criada, mas não foi possível enviar o email de ativação.";

const ANA = makeStudentRequest();
const BRUNO = makeRecruiterRequest();

type User = ReturnType<typeof userEvent.setup>;

function mockList(items: AdminRegistrationRequest[], page = 1, totalPages = 1) {
  listMock.mockResolvedValue(makePaginated(items, page, totalPages));
}

async function renderList(items: AdminRegistrationRequest[] = [ANA, BRUNO], totalPages = 1) {
  mockList(items, 1, totalPages);
  const view = render(<RegistrationRequestsView />);
  if (items.length > 0) await screen.findByText(items[0].nomeCompleto);
  return view;
}

async function openDetail(user: User, detail: AdminRegistrationRequestDetail, index = 0) {
  detailMock.mockResolvedValue(detail);
  await user.click(screen.getAllByRole("button", { name: VIEW_DETAILS })[index]);
  return screen.findByRole("dialog", { name: DETAIL_TITLE });
}

async function openPendingDetail(user: User, detail = makeStudentRequestDetail()) {
  await renderList();
  const dialog = await openDetail(user, detail);
  await within(dialog).findByRole("heading", { name: detail.nomeCompleto });
  return dialog;
}

function line(dialog: HTMLElement, label: string) {
  return within(dialog).queryByText(`${label}:`, { selector: "strong" })?.parentElement?.textContent;
}

async function startRejection(user: User) {
  const dialog = await openPendingDetail(user);
  await user.click(within(dialog).getByRole("button", { name: REJECT_LABEL }));
  return screen.findByRole("dialog", { name: REJECT_TITLE });
}

async function selectOption(user: User, field: string, option: string) {
  await user.click(screen.getByRole("combobox", { name: field }));
  await user.click(await screen.findByRole("option", { name: option }));
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("RegistrationRequestsView list", () => {
  it("shows skeletons and requests the pending requests first", () => {
    listMock.mockReturnValue(new Promise(() => undefined));
    const { container } = render(<RegistrationRequestsView />);

    expect(screen.getByRole("heading", { level: 1, name: "Solicitações de cadastro" })).toBeTruthy();
    expect(container.querySelectorAll(".MuiSkeleton-root")).toHaveLength(3);
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull();
    expect(listMock).toHaveBeenCalledWith(1, "", "", "PENDENTE");
  });

  it("renders a student card and a recruiter card", async () => {
    await renderList();

    expect(screen.getByText("Ana Lima")).toBeTruthy();
    expect(screen.getByText("ana@example.com · (32) 99999-8888 · Rio Pomba/MG")).toBeTruthy();
    expect(screen.getByText("IF Sudeste MG · Sistemas de Informação · Graduação")).toBeTruthy();
    expect(screen.getByText("Aluno")).toBeTruthy();
    expect(screen.getByText("Bruno Reis")).toBeTruthy();
    expect(screen.getByText("Empresa X · Gerente de RH")).toBeTruthy();
    expect(screen.getByText("Recrutador")).toBeTruthy();
    expect(screen.getAllByText("Pendente")).toHaveLength(2);
    expect(screen.getAllByText(`Solicitada ${formatUpdatedAt(ANA.criadoEm)}`)).toHaveLength(2);
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("omits the formation type of a student without it and labels processed statuses", async () => {
    await renderList([
      makeStudentRequest({ id: "r-1", nomeCompleto: "Sem Formação", tipoFormacao: null }),
      makeStudentRequest({ id: "r-2", nomeCompleto: "Aprovada", status: "APROVADA" }),
      makeStudentRequest({ id: "r-3", nomeCompleto: "Rejeitada", status: "REJEITADA" }),
    ]);

    expect(screen.getByText("IF Sudeste MG · Sistemas de Informação")).toBeTruthy();
    expect(screen.getByText("Pendente")).toBeTruthy();
    expect(screen.getByText("Aprovada", { selector: ".MuiChip-label" })).toBeTruthy();
    expect(screen.getByText("Rejeitada", { selector: ".MuiChip-label" })).toBeTruthy();
  });

  it("shows the empty state", async () => {
    await renderList([]);

    expect(await screen.findByText(EMPTY_TEXT)).toBeTruthy();
    expect(screen.queryByRole("button", { name: VIEW_DETAILS })).toBeNull();
  });

  it("shows the API error message and retries", async () => {
    listMock.mockRejectedValueOnce(new ApiError(SERVER_ERROR, "Falha no servidor"));
    mockList([ANA]);
    const user = userEvent.setup();
    render(<RegistrationRequestsView />);

    expect((await screen.findByRole("alert")).textContent).toContain("Falha no servidor");
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByText("Ana Lima")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback message for unknown loading failures", async () => {
    listMock.mockRejectedValue("boom");
    render(<RegistrationRequestsView />);

    expect((await screen.findByRole("alert")).textContent).toContain(LIST_FALLBACK);
  });

  it("paginates and requests the chosen page", async () => {
    await renderList([ANA], 3);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Go to page 2" }));

    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(2, "", "", "PENDENTE"));
  });

  it("ignores a slower response that arrives after a newer request", async () => {
    const slow = deferred<PaginatedResponse<AdminRegistrationRequest>>();
    listMock.mockReturnValueOnce(slow.promise);
    mockList([BRUNO]);
    const user = userEvent.setup();
    render(<RegistrationRequestsView />);

    await selectOption(user, "Status", "Todos");
    expect(await screen.findByText("Bruno Reis")).toBeTruthy();
    await act(async () => {
      slow.resolve(makePaginated([ANA]));
    });

    expect(listMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Ana Lima")).toBeNull();
    expect(screen.getByText("Bruno Reis")).toBeTruthy();
  });

  it("ignores a slower failure that arrives after a newer request", async () => {
    const slow = deferred<PaginatedResponse<AdminRegistrationRequest>>();
    listMock.mockReturnValueOnce(slow.promise);
    mockList([BRUNO]);
    const user = userEvent.setup();
    render(<RegistrationRequestsView />);

    await selectOption(user, "Status", "Todos");
    await screen.findByText("Bruno Reis");
    await act(async () => {
      slow.reject(new ApiError(SERVER_ERROR, "Falha tardia"));
    });

    expect(listMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Bruno Reis")).toBeTruthy();
  });

  // The unmounted state update is a silent no-op in React 19, so these cases only exercise the
  // late-settle path; a regression would surface as an unhandled rejection or a thrown error.
  it("settles a list response that arrives after unmounting without errors", async () => {
    const pendingList = deferred<PaginatedResponse<AdminRegistrationRequest>>();
    listMock.mockReturnValueOnce(pendingList.promise);
    const { unmount } = render(<RegistrationRequestsView />);
    unmount();

    await act(async () => {
      pendingList.resolve(makePaginated([ANA]));
    });

    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("settles a list failure that arrives after unmounting without errors", async () => {
    const pendingList = deferred<PaginatedResponse<AdminRegistrationRequest>>();
    listMock.mockReturnValueOnce(pendingList.promise);
    const { unmount } = render(<RegistrationRequestsView />);
    unmount();

    await act(async () => {
      pendingList.reject(new ApiError(SERVER_ERROR, "Falha"));
    });

    expect(listMock).toHaveBeenCalledTimes(1);
  });
});

describe("RegistrationRequestsView filters", () => {
  it("searches with the trimmed term and returns to the first page", async () => {
    await renderList([ANA], 2);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Go to page 2" }));
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(2, "", "", "PENDENTE"));

    await user.type(screen.getByRole("textbox", { name: /Buscar nome/ }), "  ana  ");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(1, "ana", "", "PENDENTE"));
  });

  it("rejects an invalid search term without requesting and clears the error once fixed", async () => {
    await renderList([ANA]);
    const user = userEvent.setup();
    const input = screen.getByRole("textbox", { name: /Buscar nome/ });
    const callsBefore = listMock.mock.calls.length;

    await user.type(input, "ana 😀");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    expect(screen.getByText("Informe uma busca válida.")).toBeTruthy();
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(listMock).toHaveBeenCalledTimes(callsBefore);

    await user.clear(input);
    await user.type(input, "ana");
    await user.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(1, "ana", "", "PENDENTE"));
    expect(screen.queryByText("Informe uma busca válida.")).toBeNull();
  });

  it("limits the search draft to 150 characters", async () => {
    await renderList([ANA]);
    const input = screen.getByRole("textbox", { name: /Buscar nome/ }) as HTMLInputElement;

    fireEvent.change(input, { target: { value: "a".repeat(200) } });

    expect(input.value).toHaveLength(150);
  });

  it("filters by type", async () => {
    await renderList([ANA], 2);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Go to page 2" }));
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(2, "", "", "PENDENTE"));

    await selectOption(user, "Tipo", "Recrutadores");

    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(1, "", "RECRUTADOR", "PENDENTE"));
  });

  it.each([
    { option: "Todos", expected: "" },
    { option: "Aprovadas", expected: "APROVADA" },
    { option: "Rejeitadas", expected: "REJEITADA" },
  ])("filters by status $option", async ({ option, expected }) => {
    await renderList([ANA], 2);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Go to page 2" }));
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(2, "", "", "PENDENTE"));

    await selectOption(user, "Status", option);

    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(1, "", "", expected));
  });

  it("shows the empty state for a filter without results", async () => {
    await renderList([ANA]);
    const user = userEvent.setup();
    mockList([]);

    await selectOption(user, "Tipo", "Alunos");

    expect(await screen.findByText(EMPTY_TEXT)).toBeTruthy();
    expect(listMock).toHaveBeenLastCalledWith(1, "", "ALUNO", "PENDENTE");
  });
});

describe("RegistrationRequestsView detail dialog", () => {
  it("shows a skeleton while the detail loads", async () => {
    await renderList();
    const user = userEvent.setup();
    detailMock.mockReturnValue(new Promise(() => undefined));

    await user.click(screen.getAllByRole("button", { name: VIEW_DETAILS })[0]);

    const dialog = await screen.findByRole("dialog", { name: DETAIL_TITLE });
    expect(dialog.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(0);
    expect(within(dialog).queryByRole("button", { name: APPROVE_LABEL })).toBeNull();
    expect(detailMock).toHaveBeenCalledWith("req-aluno");
  });

  it("renders every field of a pending student request with its actions", async () => {
    const user = userEvent.setup();
    const dialog = await openPendingDetail(user);

    expect(within(dialog).getByText("Pendente", { selector: ".MuiChip-label" })).toBeTruthy();
    expect(within(dialog).getByText("Aluno")).toBeTruthy();
    expect(line(dialog, "E-mail")).toBe("E-mail: ana@example.com");
    expect(line(dialog, "Telefone")).toBe("Telefone: (32) 99999-8888");
    expect(line(dialog, "Localização")).toBe("Localização: Rio Pomba/MG");
    expect(line(dialog, "Enviada em")).toBe(`Enviada em: ${formatUpdatedAt(ANA.criadoEm)}`);
    expect(line(dialog, "Instituição")).toBe("Instituição: IF Sudeste MG");
    expect(line(dialog, "Curso")).toBe("Curso: Sistemas de Informação");
    expect(line(dialog, "Tipo de formação")).toBe("Tipo de formação: Graduação");
    expect(line(dialog, "Ano previsto")).toBe("Ano previsto: 2027");
    expect(line(dialog, "Relação RPV")).toBe("Relação RPV: Egresso do curso técnico");
    expect(line(dialog, "Empresa")).toBeUndefined();
    expect(line(dialog, "Analisada em")).toBeUndefined();
    expect(within(dialog).queryByText(/Motivo da rejeição/)).toBeNull();
    expect(within(dialog).getByRole("button", { name: APPROVE_LABEL })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: REJECT_LABEL })).toBeTruthy();
  });

  it("hides the student fields that were not informed", async () => {
    const user = userEvent.setup();
    const dialog = await openPendingDetail(
      user,
      makeStudentRequestDetail({ tipoFormacao: null, anoConclusaoPrevisto: null, relacaoRioPombaValley: null }),
    );

    expect(line(dialog, "Tipo de formação")).toBeUndefined();
    expect(line(dialog, "Ano previsto")).toBeUndefined();
    expect(line(dialog, "Relação RPV")).toBeUndefined();
    expect(line(dialog, "Curso")).toBe("Curso: Sistemas de Informação");
  });

  it("renders the company fields of a recruiter request", async () => {
    await renderList();
    const user = userEvent.setup();
    const dialog = await openDetail(user, makeRecruiterRequestDetail(), 1);
    await within(dialog).findByRole("heading", { name: "Bruno Reis" });

    expect(within(dialog).getByText("Recrutador")).toBeTruthy();
    expect(line(dialog, "Empresa")).toBe("Empresa: Empresa X");
    expect(line(dialog, "Cargo")).toBe("Cargo: Gerente de RH");
    expect(line(dialog, "Site")).toBe("Site: https://empresa.com");
    expect(line(dialog, "Instituição")).toBeUndefined();
    expect(line(dialog, "Relação RPV")).toBeUndefined();
    expect(detailMock).toHaveBeenCalledWith("req-recrutador");
  });

  it("hides the site of a recruiter without one", async () => {
    await renderList();
    const user = userEvent.setup();
    const dialog = await openDetail(user, makeRecruiterRequestDetail({ siteEmpresa: null }), 1);
    await within(dialog).findByRole("heading", { name: "Bruno Reis" });

    expect(line(dialog, "Site")).toBeUndefined();
  });

  it("shows who analyzed a processed request and the rejection reason, without action buttons", async () => {
    const user = userEvent.setup();
    const dialog = await openPendingDetail(
      user,
      makeStudentRequestDetail({
        status: "REJEITADA",
        analisadoEm: "2026-09-02T10:00:00Z",
        adminEmail: "admin@instituto.edu",
        motivoRejeicao: "Dados inconsistentes",
      }),
    );

    expect(within(dialog).getByText("Rejeitada", { selector: ".MuiChip-label" })).toBeTruthy();
    expect(line(dialog, "Analisada em")).toBe(`Analisada em: ${formatUpdatedAt("2026-09-02T10:00:00Z")} por admin@instituto.edu`);
    expect(within(dialog).getByText("Motivo da rejeição: Dados inconsistentes")).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: APPROVE_LABEL })).toBeNull();
    expect(within(dialog).queryByRole("button", { name: REJECT_LABEL })).toBeNull();
  });

  it("shows the analysis date without the admin e-mail when it is unknown", async () => {
    const user = userEvent.setup();
    const dialog = await openPendingDetail(
      user,
      makeStudentRequestDetail({ status: "APROVADA", analisadoEm: "2026-09-02T10:00:00Z", adminEmail: null }),
    );

    expect(line(dialog, "Analisada em")).toBe(`Analisada em: ${formatUpdatedAt("2026-09-02T10:00:00Z")}`);
    expect(within(dialog).getByText("Aprovada", { selector: ".MuiChip-label" })).toBeTruthy();
    expect(within(dialog).queryByText(/Motivo da rejeição/)).toBeNull();
  });

  it("closes with the Fechar button", async () => {
    const user = userEvent.setup();
    const dialog = await openPendingDetail(user);

    await user.click(within(dialog).getByRole("button", { name: "Fechar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes with Escape", async () => {
    const user = userEvent.setup();
    await openPendingDetail(user);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows the API error and retries opening the request", async () => {
    await renderList();
    const user = userEvent.setup();
    detailMock.mockRejectedValueOnce(new ApiError(SERVER_ERROR, "Solicitação indisponível"));
    await user.click(screen.getAllByRole("button", { name: VIEW_DETAILS })[0]);
    const dialog = await screen.findByRole("dialog", { name: DETAIL_TITLE });

    expect((await within(dialog).findByRole("alert")).textContent).toContain("Solicitação indisponível");
    expect(within(dialog).queryByRole("button", { name: APPROVE_LABEL })).toBeNull();
    detailMock.mockResolvedValueOnce(makeStudentRequestDetail());
    await user.click(within(dialog).getByRole("button", { name: "Tentar novamente" }));

    expect(await within(dialog).findByRole("heading", { name: "Ana Lima" })).toBeTruthy();
    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(detailMock).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback message for unknown detail failures", async () => {
    await renderList();
    const user = userEvent.setup();
    detailMock.mockRejectedValue("boom");

    await user.click(screen.getAllByRole("button", { name: VIEW_DETAILS })[0]);

    const dialog = await screen.findByRole("dialog", { name: DETAIL_TITLE });
    expect((await within(dialog).findByRole("alert")).textContent).toContain(DETAIL_FALLBACK);
  });

  async function openStaleThenOtherDetail(user: User, slow: Deferred<AdminRegistrationRequestDetail>) {
    await renderList();
    detailMock.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(makeRecruiterRequestDetail());
    await user.click(screen.getAllByRole("button", { name: VIEW_DETAILS })[0]);
    const first = await screen.findByRole("dialog", { name: DETAIL_TITLE });
    await user.click(within(first).getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(screen.getAllByRole("button", { name: VIEW_DETAILS })[1]);
    const dialog = await screen.findByRole("dialog", { name: DETAIL_TITLE });
    await within(dialog).findByRole("heading", { name: "Bruno Reis" });
    return dialog;
  }

  it("ignores a detail response from a request replaced by another one", async () => {
    const user = userEvent.setup();
    const slow = deferred<AdminRegistrationRequestDetail>();
    const dialog = await openStaleThenOtherDetail(user, slow);

    await act(async () => {
      slow.resolve(makeStudentRequestDetail());
    });

    expect(within(dialog).queryByRole("heading", { name: "Ana Lima" })).toBeNull();
    expect(within(dialog).getByRole("heading", { name: "Bruno Reis" })).toBeTruthy();
  });

  it("ignores a detail failure from a request replaced by another one", async () => {
    const user = userEvent.setup();
    const slow = deferred<AdminRegistrationRequestDetail>();
    const dialog = await openStaleThenOtherDetail(user, slow);

    await act(async () => {
      slow.reject(new ApiError(SERVER_ERROR, "Falha tardia"));
    });

    expect(within(dialog).queryByRole("alert")).toBeNull();
    expect(within(dialog).queryByText("Falha tardia")).toBeNull();
    expect(within(dialog).getByRole("heading", { name: "Bruno Reis" })).toBeTruthy();
  });

  // The unmounted state update is a silent no-op in React 19, so these cases only exercise the
  // late-settle path; a regression would surface as an unhandled rejection or a thrown error.
  it("settles a detail response that arrives after unmounting without errors", async () => {
    const { unmount } = await renderList();
    const user = userEvent.setup();
    const slow = deferred<AdminRegistrationRequestDetail>();
    detailMock.mockReturnValue(slow.promise);
    await user.click(screen.getAllByRole("button", { name: VIEW_DETAILS })[0]);
    await screen.findByRole("dialog", { name: DETAIL_TITLE });
    unmount();

    await act(async () => {
      slow.resolve(makeStudentRequestDetail());
    });

    expect(detailMock).toHaveBeenCalledTimes(1);
  });

  it("settles a detail failure that arrives after unmounting without errors", async () => {
    const { unmount } = await renderList();
    const user = userEvent.setup();
    const slow = deferred<AdminRegistrationRequestDetail>();
    detailMock.mockReturnValue(slow.promise);
    await user.click(screen.getAllByRole("button", { name: VIEW_DETAILS })[0]);
    await screen.findByRole("dialog", { name: DETAIL_TITLE });
    unmount();

    await act(async () => {
      slow.reject(new ApiError(SERVER_ERROR, "Falha"));
    });

    expect(detailMock).toHaveBeenCalledTimes(1);
  });
});

describe("RegistrationRequestsView approval", () => {
  it("approves, closes the dialog, refreshes the list and confirms that the email was sent", async () => {
    const user = userEvent.setup();
    const dialog = await openPendingDetail(user);
    approveMock.mockResolvedValue({ userId: "u-1", activationSent: true });
    listMock.mockResolvedValue(makePaginated([BRUNO]));

    await user.click(within(dialog).getByRole("button", { name: APPROVE_LABEL }));

    expect(await screen.findByText(APPROVED_NOTICE)).toBeTruthy();
    expect(approveMock).toHaveBeenCalledWith("req-aluno");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.queryByText("Ana Lima")).toBeNull());
    expect(screen.getByText("Bruno Reis")).toBeTruthy();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it("warns when the activation email was not sent and resends it", async () => {
    const user = userEvent.setup();
    const dialog = await openPendingDetail(user);
    approveMock.mockResolvedValue({ userId: "u-1", activationSent: false });
    resendMock.mockResolvedValue(undefined);

    await user.click(within(dialog).getByRole("button", { name: APPROVE_LABEL }));
    expect(await screen.findByText(NOT_SENT_NOTICE)).toBeTruthy();
    await user.click(await screen.findByRole("button", { name: "Reenviar ativação" }));

    expect(await screen.findByText("Email de ativação reenviado.")).toBeTruthy();
    expect(resendMock).toHaveBeenCalledWith("u-1");
  });

  it("dismisses the approval notice with Escape", async () => {
    const user = userEvent.setup();
    const dialog = await openPendingDetail(user);
    approveMock.mockResolvedValue({ userId: "u-1", activationSent: true });
    await user.click(within(dialog).getByRole("button", { name: APPROVE_LABEL }));
    await screen.findByText(APPROVED_NOTICE);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText(APPROVED_NOTICE)).toBeNull());
  });

  it("goes back a page when the processed request was the last one of the page", async () => {
    await renderList([ANA], 2);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Go to page 2" }));
    await waitFor(() => expect(listMock).toHaveBeenLastCalledWith(2, "", "", "PENDENTE"));
    const dialog = await openDetail(user, makeStudentRequestDetail());
    await within(dialog).findByRole("heading", { name: "Ana Lima" });
    approveMock.mockResolvedValue({ userId: "u-1", activationSent: true });
    listMock.mockResolvedValueOnce(makePaginated([], 2, 2)).mockResolvedValueOnce(makePaginated([BRUNO], 1, 1));

    await user.click(within(dialog).getByRole("button", { name: APPROVE_LABEL }));

    expect(await screen.findByText("Bruno Reis")).toBeTruthy();
    expect(listMock).toHaveBeenLastCalledWith(1, "", "", "PENDENTE");
  });

  it("stays on the first page when it becomes empty", async () => {
    const user = userEvent.setup();
    const dialog = await openPendingDetail(user);
    approveMock.mockResolvedValue({ userId: "u-1", activationSent: true });
    listMock.mockResolvedValue(makePaginated([]));

    await user.click(within(dialog).getByRole("button", { name: APPROVE_LABEL }));

    expect(await screen.findByText(EMPTY_TEXT)).toBeTruthy();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the dialog open and shows the API error when approving fails", async () => {
    const user = userEvent.setup();
    const dialog = await openPendingDetail(user);
    approveMock.mockRejectedValue(new ApiError(SERVER_ERROR, "Não foi possível ativar"));

    await user.click(within(dialog).getByRole("button", { name: APPROVE_LABEL }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain("Não foi possível ativar");
    expect(within(dialog).getByRole("button", { name: APPROVE_LABEL }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText(APPROVED_NOTICE)).toBeNull();
    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("uses the fallback message for unknown approval failures", async () => {
    const user = userEvent.setup();
    const dialog = await openPendingDetail(user);
    approveMock.mockRejectedValue("boom");

    await user.click(within(dialog).getByRole("button", { name: APPROVE_LABEL }));

    expect((await within(dialog).findByRole("alert")).textContent).toContain(APPROVE_FALLBACK);
  });

  it("blocks the dialog while the approval is in progress", async () => {
    const user = userEvent.setup();
    const dialog = await openPendingDetail(user);
    const pending = deferred<{ userId: string; activationSent: boolean }>();
    approveMock.mockReturnValue(pending.promise);

    await user.click(within(dialog).getByRole("button", { name: APPROVE_LABEL }));

    const busyButton = await within(dialog).findByRole("button", { name: "Aprovando..." });
    expect(busyButton.hasAttribute("disabled")).toBe(true);
    expect(within(dialog).getByRole("button", { name: "Fechar" }).hasAttribute("disabled")).toBe(true);
    expect(within(dialog).getByRole("button", { name: REJECT_LABEL }).hasAttribute("disabled")).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: DETAIL_TITLE })).toBeTruthy();

    pending.resolve({ userId: "u-1", activationSent: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});

describe("RegistrationRequestsView rejection", () => {
  it("opens the rejection dialog and cancels it without calling the API", async () => {
    const user = userEvent.setup();
    const rejection = await startRejection(user);

    await user.click(within(rejection).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: REJECT_TITLE })).toBeNull());
    expect(screen.getByRole("dialog", { name: DETAIL_TITLE })).toBeTruthy();
    expect(rejectMock).not.toHaveBeenCalled();
  });

  it("cancels the rejection with Escape", async () => {
    const user = userEvent.setup();
    await startRejection(user);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog", { name: REJECT_TITLE })).toBeNull());
    expect(screen.getByRole("dialog", { name: DETAIL_TITLE })).toBeTruthy();
  });

  it("rejects with the trimmed reason without emojis, refreshes the list and shows the notice", async () => {
    const user = userEvent.setup();
    const rejection = await startRejection(user);
    rejectMock.mockResolvedValue(undefined);
    listMock.mockResolvedValue(makePaginated([BRUNO]));

    await user.type(within(rejection).getByRole("textbox", { name: REASON_LABEL }), "  Dados 😀  ");
    await user.click(within(rejection).getByRole("button", { name: "Rejeitar" }));

    expect(await screen.findByText(REJECTED_NOTICE)).toBeTruthy();
    expect(rejectMock).toHaveBeenCalledWith("req-aluno", "Dados");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(screen.queryByText("Ana Lima")).toBeNull());
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it("rejects without a reason when the field is blank", async () => {
    const user = userEvent.setup();
    const rejection = await startRejection(user);
    rejectMock.mockResolvedValue(undefined);

    await user.type(within(rejection).getByRole("textbox", { name: REASON_LABEL }), "   ");
    await user.click(within(rejection).getByRole("button", { name: "Rejeitar" }));

    await waitFor(() => expect(rejectMock).toHaveBeenCalledWith("req-aluno", undefined));
    expect(await screen.findByText(REJECTED_NOTICE)).toBeTruthy();
  });

  it("limits the reason to 500 characters", async () => {
    const user = userEvent.setup();
    const rejection = await startRejection(user);
    const reason = within(rejection).getByRole("textbox", { name: REASON_LABEL }) as HTMLTextAreaElement;

    fireEvent.change(reason, { target: { value: "a".repeat(600) } });

    expect(reason.value).toHaveLength(500);
  });

  it("dismisses the rejection notice with Escape", async () => {
    const user = userEvent.setup();
    const rejection = await startRejection(user);
    rejectMock.mockResolvedValue(undefined);
    await user.click(within(rejection).getByRole("button", { name: "Rejeitar" }));
    await screen.findByText(REJECTED_NOTICE);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByText(REJECTED_NOTICE)).toBeNull());
  });

  it("shows the API error in the rejection dialog and clears it when cancelled", async () => {
    const user = userEvent.setup();
    const rejection = await startRejection(user);
    rejectMock.mockRejectedValue(new ApiError(SERVER_ERROR, "Rejeição indisponível"));

    await user.click(within(rejection).getByRole("button", { name: "Rejeitar" }));

    expect((await within(rejection).findByRole("alert")).textContent).toContain("Rejeição indisponível");
    expect(within(rejection).getByRole("button", { name: "Rejeitar" }).hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText(REJECTED_NOTICE)).toBeNull();

    await user.click(within(rejection).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: REJECT_TITLE })).toBeNull());
    const detail = screen.getByRole("dialog", { name: DETAIL_TITLE });
    expect(within(detail).queryByRole("alert")).toBeNull();
    await user.click(within(detail).getByRole("button", { name: REJECT_LABEL }));

    const reopened = await screen.findByRole("dialog", { name: REJECT_TITLE });
    expect(within(reopened).queryByRole("alert")).toBeNull();
  });

  it("uses the fallback message for unknown rejection failures", async () => {
    const user = userEvent.setup();
    const rejection = await startRejection(user);
    rejectMock.mockRejectedValue("boom");

    await user.click(within(rejection).getByRole("button", { name: "Rejeitar" }));

    expect((await within(rejection).findByRole("alert")).textContent).toContain(REJECT_FALLBACK);
  });

  it("blocks the dialog while the rejection is in progress", async () => {
    const user = userEvent.setup();
    const rejection = await startRejection(user);
    const pending = deferred<void>();
    rejectMock.mockReturnValue(pending.promise);

    await user.click(within(rejection).getByRole("button", { name: "Rejeitar" }));

    const busyButton = await within(rejection).findByRole("button", { name: "Rejeitando..." });
    expect(busyButton.hasAttribute("disabled")).toBe(true);
    expect(within(rejection).getByRole("button", { name: "Cancelar" }).hasAttribute("disabled")).toBe(true);
    expect(within(rejection).getByRole("textbox", { name: REASON_LABEL }).hasAttribute("disabled")).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: REJECT_TITLE })).toBeTruthy();

    pending.resolve();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("clears the typed reason when another request is opened", async () => {
    const user = userEvent.setup();
    const rejection = await startRejection(user);
    await user.type(within(rejection).getByRole("textbox", { name: REASON_LABEL }), "Motivo antigo");
    await user.click(within(rejection).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: REJECT_TITLE })).toBeNull());
    await user.click(within(screen.getByRole("dialog", { name: DETAIL_TITLE })).getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    const detail = await openDetail(user, makeStudentRequestDetail());
    await within(detail).findByRole("heading", { name: "Ana Lima" });
    await user.click(within(detail).getByRole("button", { name: REJECT_LABEL }));

    const reopened = await screen.findByRole("dialog", { name: REJECT_TITLE });
    expect((within(reopened).getByRole("textbox", { name: REASON_LABEL }) as HTMLTextAreaElement).value).toBe("");
  });
});
