import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { TrajetoriaSection } from "@/components/profile/TrajetoriaSection";
import { ApiError, apiDownload } from "@/lib/api";
import {
  createExperiencia,
  createFormacao,
  deleteExperiencia,
  deleteFormacao,
  deleteFormationCertificate,
  fetchTrajectory,
  updateExperiencia,
  updateFormacao,
  uploadFormationCertificate,
} from "@/lib/student";
import type { ExperienciaResponse, FormacaoResponse, TrajetoriaItemResponse } from "@/types/student";
import { deferred, makeSectionProps } from "./profileFixtures";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiDownload: vi.fn(),
}));
vi.mock("@/lib/student");
vi.setConfig({ testTimeout: 15_000 });

const LOAD_ERROR = "Não foi possível carregar sua trajetória.";
const FORMATION_EMPTY = "Adicione formações acadêmicas, cursos e certificados para destacar seu preparo.";
const EXPERIENCE_EMPTY = "Adicione experiências profissionais ou estágios para mostrar sua trajetória.";
const ADD_FORMATION = "Adicionar formação";
const ADD_EXPERIENCE = "Adicionar experiência";
const EDIT_FORMATION_DIALOG = "Editar formação";
const EDIT_EXPERIENCE_DIALOG = "Editar experiência";
const FORMATION_REVIEW_ERROR = "Revise nome, instituição, datas e carga horária.";
const EXPERIENCE_REVIEW_ERROR = "Revise empresa, cargo e datas.";
const NOT_PDF = "O arquivo selecionado não é um PDF válido.";
const SAVE = "Salvar";
const CANCEL = "Cancelar";
const FORMATION_NAME = "Engenharia de Software";
const FORMATION_INSTITUTION = "UFV";
const OTHER_FORMATION_NAME = "Curso de Go";
const COMPANY = "Acme Tecnologia";
const ROLE = "Desenvolvedora Júnior";
const OBJECT_URL = "blob:certificado-temporario";
const PDF_TYPE = "application/pdf";
const MAX_BYTES = 10 * 1024 * 1024;
const REMOVED_NOTICE = "Item removido da trajetória.";
const DELETE_FORMATION_TITLE = "Excluir formação?";
const DELETE_EXPERIENCE_TITLE = "Excluir experiência?";

const fetchMock = vi.mocked(fetchTrajectory);
const createFormationMock = vi.mocked(createFormacao);
const updateFormationMock = vi.mocked(updateFormacao);
const deleteFormationMock = vi.mocked(deleteFormacao);
const createExperienceMock = vi.mocked(createExperiencia);
const updateExperienceMock = vi.mocked(updateExperiencia);
const deleteExperienceMock = vi.mocked(deleteExperiencia);
const uploadCertificateMock = vi.mocked(uploadFormationCertificate);
const deleteCertificateMock = vi.mocked(deleteFormationCertificate);
const downloadMock = vi.mocked(apiDownload);

let createObjectURL: MockInstance<typeof URL.createObjectURL>;
let revokeObjectURL: MockInstance<typeof URL.revokeObjectURL>;

type User = ReturnType<typeof userEvent.setup>;

function makeFormation(overrides: Partial<FormacaoResponse> = {}): FormacaoResponse {
  return {
    id: "f-1",
    tipo: "GRADUACAO",
    nome: FORMATION_NAME,
    instituicao: FORMATION_INSTITUTION,
    dataInicio: "2020-03-01",
    dataFim: "2024-12-15",
    cargaHoraria: 3600,
    status: "CONCLUIDO",
    principal: false,
    ehRioPombaValley: false,
    statusValidacaoRpv: null,
    possuiCertificado: false,
    criadoEm: "2020-03-01T00:00:00Z",
    atualizadoEm: "2024-12-15T00:00:00Z",
    ...overrides,
  };
}

function makeExperience(overrides: Partial<ExperienciaResponse> = {}): ExperienciaResponse {
  return {
    id: "e-1",
    empresa: COMPANY,
    cargo: ROLE,
    tipo: "PROFISSIONAL",
    dataInicio: "2023-02-01",
    dataFim: "2024-01-31",
    atual: false,
    descricao: "Manutenção de APIs REST.",
    criadoEm: "2023-02-01T00:00:00Z",
    atualizadoEm: "2024-01-31T00:00:00Z",
    ...overrides,
  };
}

function formationItem(formation: FormacaoResponse = makeFormation()): TrajetoriaItemResponse {
  return {
    tipoItem: "FORMACAO",
    id: formation.id,
    titulo: formation.nome,
    subtitulo: formation.instituicao,
    dataInicio: formation.dataInicio,
    dataFim: formation.dataFim,
    atual: false,
    formacao: formation,
    experiencia: null,
  };
}

function experienceItem(experience: ExperienciaResponse = makeExperience()): TrajetoriaItemResponse {
  return {
    tipoItem: "EXPERIENCIA",
    id: experience.id,
    titulo: experience.cargo,
    subtitulo: experience.empresa,
    dataInicio: experience.dataInicio,
    dataFim: experience.dataFim,
    atual: experience.atual,
    formacao: null,
    experiencia: experience,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue(OBJECT_URL);
  revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockReturnValue(undefined);
  fetchMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function renderSection(items: TrajetoriaItemResponse[] = []) {
  fetchMock.mockResolvedValue(items);
  const props = makeSectionProps();
  render(<TrajetoriaSection {...props} />);
  await screen.findByText("Formação e certificados");
  await waitFor(() => expect(screen.queryByRole("progressbar")).toBeNull());
  return props;
}

const field = (label: string) =>
  screen.getByRole("textbox", { name: new RegExp(`^${label}`) }) as HTMLInputElement | HTMLTextAreaElement;

async function fill(user: User, label: string, value: string) {
  const input = field(label);
  await user.clear(input);
  if (value) {
    await user.click(input);
    await user.paste(value);
  }
}

async function choose(user: User, dialog: HTMLElement, select: string, option: string) {
  await user.click(within(dialog).getByRole("combobox", { name: select }));
  await user.click(await screen.findByRole("option", { name: option }));
}

function pdfFile(name = "certificado.pdf", type = PDF_TYPE) {
  return new File(["%PDF-1.7 conteudo"], name, { type });
}

const certificateInput = (name = FORMATION_NAME) =>
  screen.getByLabelText(`Selecionar certificado em PDF para ${name}`) as HTMLInputElement;

async function openFormationAdd(user: User) {
  await user.click(screen.getByRole("button", { name: ADD_FORMATION }));
  return screen.findByRole("dialog", { name: ADD_FORMATION });
}

async function openExperienceAdd(user: User) {
  await user.click(screen.getByRole("button", { name: ADD_EXPERIENCE }));
  return screen.findByRole("dialog", { name: ADD_EXPERIENCE });
}

async function fillValidFormation(user: User) {
  await fill(user, "Nome", `  ${FORMATION_NAME}  `);
  await fill(user, "Instituição", ` ${FORMATION_INSTITUTION} `);
  await fill(user, "Início", "01032020");
}

async function fillValidExperience(user: User) {
  await fill(user, "Empresa", `  ${COMPANY}  `);
  await fill(user, "Cargo", ` ${ROLE} `);
  await fill(user, "Início", "01022023");
  await fill(user, "Término", "31012024");
}

describe("TrajetoriaSection loading and listing", () => {
  it("shows a spinner and hides both groups while the trajectory is loading", async () => {
    const pending = deferred<TrajetoriaItemResponse[]>();
    fetchMock.mockReturnValue(pending.promise);
    render(<TrajetoriaSection {...makeSectionProps()} />);

    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(screen.queryByText("Formação e certificados")).toBeNull();
    expect(screen.getByRole("heading", { name: "Trajetória" })).toBeTruthy();

    pending.resolve([]);
    expect(await screen.findByText("Formação e certificados")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("shows the load error and no groups when the fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<TrajetoriaSection {...makeSectionProps()} />);

    expect((await screen.findByRole("alert")).textContent).toBe(LOAD_ERROR);
    expect(screen.queryByText("Formação e certificados")).toBeNull();
  });

  it("shows an empty state with an add action in each group when there are no items", async () => {
    await renderSection([]);

    expect(screen.getByText(FORMATION_EMPTY)).toBeTruthy();
    expect(screen.getByText(EXPERIENCE_EMPTY)).toBeTruthy();
    expect(screen.getByRole("button", { name: ADD_FORMATION })).toBeTruthy();
    expect(screen.getByRole("button", { name: ADD_EXPERIENCE })).toBeTruthy();
  });

  it("splits items into formation and experience groups with dates and descriptions", async () => {
    await renderSection([
      formationItem(),
      experienceItem(),
      experienceItem(makeExperience({ id: "e-2", cargo: "Estagiário", empresa: "Beta SA", atual: true, dataFim: null, descricao: null, tipo: "ESTAGIO" })),
    ]);

    expect(screen.getByText(FORMATION_NAME)).toBeTruthy();
    expect(screen.getByText(`${FORMATION_INSTITUTION} · 01/03/2020 — 15/12/2024`)).toBeTruthy();
    expect(screen.getByText(`${COMPANY} · 01/02/2023 — 31/01/2024`)).toBeTruthy();
    expect(screen.getByText("Beta SA · 01/02/2023 — Atual")).toBeTruthy();
    expect(screen.getByText("Manutenção de APIs REST.")).toBeTruthy();
    expect(screen.queryByText(FORMATION_EMPTY)).toBeNull();
    expect(screen.queryByText(EXPERIENCE_EMPTY)).toBeNull();
    expect(screen.getByRole("button", { name: ADD_FORMATION })).toBeTruthy();
    expect(screen.getByRole("button", { name: ADD_EXPERIENCE })).toBeTruthy();
  });

  it("shows 'Atual' for a formation without an end date", async () => {
    await renderSection([formationItem(makeFormation({ dataFim: null, status: "EM_ANDAMENTO" }))]);

    expect(screen.getByText(`${FORMATION_INSTITUTION} · 01/03/2020 — Atual`)).toBeTruthy();
  });

  it("marks the main formation and hides the Rio Pomba Valley chip for other formations", async () => {
    await renderSection([formationItem(makeFormation({ principal: true }))]);

    expect(screen.getByText("Principal")).toBeTruthy();
    expect(screen.queryByText(/Rio Pomba Valley/)).toBeNull();
    expect(screen.queryByText("Aguardando validação")).toBeNull();
  });

  const validationChips: [string, FormacaoResponse["statusValidacaoRpv"], string][] = [
    ["pending", "PENDENTE", "Aguardando validação"],
    ["verified", "VERIFICADO", "Verificado pelo Rio Pomba Valley"],
    ["rejected", "REJEITADO", "Validação não aprovada"],
    ["not yet assigned", null, "Aguardando validação"],
  ];

  it.each(validationChips)("shows the %s validation chip for a Rio Pomba Valley formation", async (_label, status, text) => {
    await renderSection([formationItem(makeFormation({ ehRioPombaValley: true, statusValidacaoRpv: status }))]);

    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText("Alterações na formação ou no certificado podem exigir uma nova validação.")).toBeTruthy();
  });
});

describe("TrajetoriaSection certificate", () => {
  it("offers only the upload action when the formation has no certificate", async () => {
    await renderSection([formationItem()]);

    expect(screen.getByRole("button", { name: "Enviar certificado" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Abrir certificado" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();
  });

  it("offers open, replace and remove when the formation has a certificate", async () => {
    await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);

    expect(screen.getByRole("button", { name: "Abrir certificado" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Substituir certificado" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remover" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Enviar certificado" })).toBeNull();
  });

  it("opens the native file picker from the upload button", async () => {
    const user = userEvent.setup();
    await renderSection([formationItem()]);
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);

    await user.click(screen.getByRole("button", { name: "Enviar certificado" }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("opens the native file picker from the replace button", async () => {
    const user = userEvent.setup();
    await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => undefined);

    await user.click(screen.getByRole("button", { name: "Substituir certificado" }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("uploads a valid PDF, refreshes the trajectory and announces the new certificate", async () => {
    const user = userEvent.setup();
    uploadCertificateMock.mockResolvedValue(undefined);
    const props = await renderSection([formationItem()]);
    const file = pdfFile();

    await user.upload(certificateInput(), file);

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Certificado enviado."));
    expect(uploadCertificateMock).toHaveBeenCalledWith("f-1", file);
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("announces a replaced certificate when one already existed", async () => {
    const user = userEvent.setup();
    uploadCertificateMock.mockResolvedValue(undefined);
    const props = await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);

    await user.upload(certificateInput(), pdfFile());

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Certificado substituído."));
  });

  it("ignores a change event without a file", async () => {
    await renderSection([formationItem()]);

    fireEvent.change(certificateInput(), { target: { files: [] } });

    expect(uploadCertificateMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  const invalidFiles: [string, () => File, string][] = [
    ["a file without the .pdf extension", () => pdfFile("certificado.txt", ""), "Envie um arquivo PDF."],
    ["a file declared with a non-PDF MIME type", () => pdfFile("certificado.pdf", "text/plain"), NOT_PDF],
    ["an empty PDF", () => new File([], "certificado.pdf", { type: PDF_TYPE }), "O arquivo PDF está vazio."],
    [
      "a PDF larger than 10 MB",
      () => new File([new Uint8Array(MAX_BYTES + 1)], "certificado.pdf", { type: PDF_TYPE }),
      "O certificado deve ter no máximo 10 MB.",
    ],
    ["a file whose content lacks the PDF signature", () => new File(["nao e pdf de verdade"], "certificado.pdf", { type: PDF_TYPE }), NOT_PDF],
    ["a file shorter than the PDF signature", () => new File(["%PD"], "certificado.pdf", { type: PDF_TYPE }), NOT_PDF],
  ];

  it.each(invalidFiles)("rejects %s without calling the API", async (_label, build, message) => {
    const user = userEvent.setup({ applyAccept: false });
    const props = await renderSection([formationItem()]);

    await user.upload(certificateInput(), build());

    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(uploadCertificateMock).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("accepts an uppercase .PDF extension without a declared MIME type", async () => {
    const user = userEvent.setup({ applyAccept: false });
    uploadCertificateMock.mockResolvedValue(undefined);
    const props = await renderSection([formationItem()]);

    await user.upload(certificateInput(), pdfFile("CERTIFICADO.PDF", ""));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Certificado enviado."));
  });

  it("shows the API error when the upload fails", async () => {
    const user = userEvent.setup();
    uploadCertificateMock.mockRejectedValue(new ApiError(413, "Grande", { title: "Certificado grande demais" }));
    const props = await renderSection([formationItem()]);

    await user.upload(certificateInput(), pdfFile());

    expect((await screen.findByRole("alert")).textContent).toBe("Certificado grande demais");
    expect(props.onChanged).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Enviar certificado" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("falls back to the generic upload message for an opaque failure", async () => {
    const user = userEvent.setup();
    uploadCertificateMock.mockRejectedValue("falha");
    await renderSection([formationItem()]);

    await user.upload(certificateInput(), pdfFile());

    expect((await screen.findByRole("alert")).textContent).toBe("Não foi possível enviar o certificado. Tente novamente.");
  });

  it("opens the certificate in a new tab through a temporary URL revoked a second later", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const blob = new Blob(["%PDF-1.7"], { type: PDF_TYPE });
    downloadMock.mockResolvedValue(blob);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);

    await user.click(screen.getByRole("button", { name: "Abrir certificado" }));

    await waitFor(() => expect(open).toHaveBeenCalledWith(OBJECT_URL, "_blank", "noopener,noreferrer"));
    expect(downloadMock).toHaveBeenCalledWith("/api/alunos/me/formacoes/f-1/certificado");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(1000); });

    expect(revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL);
  });

  it("shows the API error when the certificate cannot be opened", async () => {
    const user = userEvent.setup();
    downloadMock.mockRejectedValue(new ApiError(404, "Nada", { title: "Certificado não encontrado" }));
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);

    await user.click(screen.getByRole("button", { name: "Abrir certificado" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Certificado não encontrado");
    expect(open).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Abrir certificado" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("falls back to the generic open message for an opaque failure", async () => {
    const user = userEvent.setup();
    downloadMock.mockRejectedValue(null);
    await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);

    await user.click(screen.getByRole("button", { name: "Abrir certificado" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Não foi possível abrir o certificado.");
  });

  it("asks for confirmation before removing the certificate and keeps it on cancel", async () => {
    const user = userEvent.setup();
    await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);

    await user.click(screen.getByRole("button", { name: "Remover" }));
    const dialog = await screen.findByRole("dialog", { name: "Remover certificado?" });
    await user.click(within(dialog).getByRole("button", { name: CANCEL }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deleteCertificateMock).not.toHaveBeenCalled();
  });

  it("dismisses the certificate confirmation with the Escape key", async () => {
    const user = userEvent.setup();
    await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);

    await user.click(screen.getByRole("button", { name: "Remover" }));
    await screen.findByRole("dialog", { name: "Remover certificado?" });
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deleteCertificateMock).not.toHaveBeenCalled();
  });

  it("ignores the Escape key while the certificate is being removed", async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    deleteCertificateMock.mockReturnValue(pending.promise);
    const props = await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);

    await user.click(screen.getByRole("button", { name: "Remover" }));
    const dialog = await screen.findByRole("dialog", { name: "Remover certificado?" });
    await user.click(within(dialog).getByRole("button", { name: "Remover certificado" }));
    await within(dialog).findByRole("button", { name: "Removendo..." });
    await user.keyboard("{Escape}");

    expect(screen.getByRole("dialog", { name: "Remover certificado?" })).toBeTruthy();

    pending.resolve();
    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Certificado removido."));
  });

  it("removes the certificate after confirmation, then refreshes and announces it", async () => {
    const user = userEvent.setup();
    deleteCertificateMock.mockResolvedValue(undefined);
    const props = await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);

    await user.click(screen.getByRole("button", { name: "Remover" }));
    const dialog = await screen.findByRole("dialog", { name: "Remover certificado?" });
    await user.click(within(dialog).getByRole("button", { name: "Remover certificado" }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Certificado removido."));
    expect(deleteCertificateMock).toHaveBeenCalledWith("f-1");
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("locks the dialog while the certificate is being removed", async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    deleteCertificateMock.mockReturnValue(pending.promise);
    const props = await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);

    await user.click(screen.getByRole("button", { name: "Remover" }));
    const dialog = await screen.findByRole("dialog", { name: "Remover certificado?" });
    await user.click(within(dialog).getByRole("button", { name: "Remover certificado" }));

    expect((await within(dialog).findByRole("button", { name: "Removendo..." }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: CANCEL }) as HTMLButtonElement).disabled).toBe(true);

    pending.resolve();
    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Certificado removido."));
  });

  it("closes the dialog and shows the API error when removing the certificate fails", async () => {
    const user = userEvent.setup();
    deleteCertificateMock.mockRejectedValue(new ApiError(500, "Erro", { title: "Falha ao remover certificado" }));
    const props = await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);

    await user.click(screen.getByRole("button", { name: "Remover" }));
    const dialog = await screen.findByRole("dialog", { name: "Remover certificado?" });
    await user.click(within(dialog).getByRole("button", { name: "Remover certificado" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((await screen.findByRole("alert")).textContent).toBe("Falha ao remover certificado");
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("falls back to the generic message when removing the certificate fails opaquely", async () => {
    const user = userEvent.setup();
    deleteCertificateMock.mockRejectedValue(undefined);
    await renderSection([formationItem(makeFormation({ possuiCertificado: true }))]);

    await user.click(screen.getByRole("button", { name: "Remover" }));
    const dialog = await screen.findByRole("dialog", { name: "Remover certificado?" });
    await user.click(within(dialog).getByRole("button", { name: "Remover certificado" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Não foi possível alterar o certificado.");
  });
});

describe("TrajetoriaSection formation form", () => {
  it("opens with sensible defaults and a disabled end date for an in-progress formation", async () => {
    const user = userEvent.setup();
    await renderSection([]);

    const dialog = await openFormationAdd(user);

    expect(within(dialog).getByRole("combobox", { name: "Tipo" }).textContent).toBe("Graduação");
    expect(within(dialog).getByRole("combobox", { name: "Status" }).textContent).toBe("Em andamento");
    expect(field("Conclusão").disabled).toBe(true);
    expect((within(dialog).getByRole("switch", { name: "Formação principal" }) as HTMLInputElement).checked).toBe(false);
    expect((within(dialog).getByRole("switch", { name: "Formação no Rio Pomba Valley" }) as HTMLInputElement).checked).toBe(false);
  });

  const formationBase = { Nome: FORMATION_NAME, Instituição: FORMATION_INSTITUTION, Início: "01032020" };
  const invalidFormations: [string, (user: User, dialog: HTMLElement) => Promise<void>][] = [
    ["a name that is too short", async (user) => fill(user, "Nome", "A")],
    ["an institution that is too short", async (user) => fill(user, "Instituição", "B")],
    ["a missing start date", async (user) => fill(user, "Início", "")],
    ["a start date that does not exist", async (user) => fill(user, "Início", "31022020")],
    ["an incomplete start date", async (user) => fill(user, "Início", "0103")],
    ["a workload of zero", async (user) => fill(user, "Carga horária", "0")],
    [
      "a concluded formation without an end date",
      async (user, dialog) => choose(user, dialog, "Status", "Concluído"),
    ],
    [
      "a concluded formation with an impossible end date",
      async (user, dialog) => {
        await choose(user, dialog, "Status", "Concluído");
        await fill(user, "Conclusão", "31022021");
      },
    ],
    [
      "an end date before the start date",
      async (user, dialog) => {
        await choose(user, dialog, "Status", "Concluído");
        await fill(user, "Conclusão", "31122019");
      },
    ],
  ];

  it.each(invalidFormations)("rejects %s", async (_label, mutate) => {
    const user = userEvent.setup();
    await renderSection([]);
    const dialog = await openFormationAdd(user);

    for (const [label, value] of Object.entries(formationBase)) await fill(user, label, value);
    await mutate(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(FORMATION_REVIEW_ERROR);
    expect(createFormationMock).not.toHaveBeenCalled();
  });

  it("creates an in-progress formation with trimmed text, ISO date and null optional fields", async () => {
    const user = userEvent.setup();
    createFormationMock.mockResolvedValue(makeFormation());
    const props = await renderSection([]);
    const dialog = await openFormationAdd(user);

    await fillValidFormation(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Formação adicionada."));
    expect(createFormationMock).toHaveBeenCalledWith({
      tipo: "GRADUACAO",
      nome: FORMATION_NAME,
      instituicao: FORMATION_INSTITUTION,
      dataInicio: "2020-03-01",
      dataFim: null,
      cargaHoraria: null,
      status: "EM_ANDAMENTO",
      principal: false,
      ehRioPombaValley: false,
    });
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("creates a concluded formation with every chosen option", async () => {
    const user = userEvent.setup();
    createFormationMock.mockResolvedValue(makeFormation());
    const props = await renderSection([]);
    const dialog = await openFormationAdd(user);

    await fill(user, "Nome", OTHER_FORMATION_NAME);
    await fill(user, "Instituição", "Alura");
    await fill(user, "Início", "01022024");
    await choose(user, dialog, "Tipo", "Curso livre");
    await choose(user, dialog, "Status", "Concluído");
    await fill(user, "Conclusão", "01062024");
    await fill(user, "Carga horária", "40");
    await user.click(within(dialog).getByRole("switch", { name: "Formação principal" }));
    await user.click(within(dialog).getByRole("switch", { name: "Formação no Rio Pomba Valley" }));
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Formação adicionada."));
    expect(createFormationMock).toHaveBeenCalledWith({
      tipo: "CURSO_LIVRE",
      nome: OTHER_FORMATION_NAME,
      instituicao: "Alura",
      dataInicio: "2024-02-01",
      dataFim: "2024-06-01",
      cargaHoraria: 40,
      status: "CONCLUIDO",
      principal: true,
      ehRioPombaValley: true,
    });
  });

  it("masks dates and keeps only digits in the workload", async () => {
    const user = userEvent.setup();
    await renderSection([]);
    const dialog = await openFormationAdd(user);

    await user.type(field("Início"), "1");
    expect(field("Início").value).toBe("1");
    await user.type(field("Início"), "00");
    expect(field("Início").value).toBe("10/0");
    await user.type(field("Início"), "12025");
    expect(field("Início").value).toBe("10/01/2025");

    await choose(user, dialog, "Status", "Concluído");
    await user.type(field("Conclusão"), "0501");
    expect(field("Conclusão").value).toBe("05/01");

    await user.type(field("Carga horária"), "1a2b3");
    expect(field("Carga horária").value).toBe("123");
    await user.clear(field("Carga horária"));
    expect(field("Carga horária").value).toBe("");
  });

  it("clears the end date when switching to in-progress and saves it as null", async () => {
    const user = userEvent.setup();
    createFormationMock.mockResolvedValue(makeFormation());
    const props = await renderSection([]);
    const dialog = await openFormationAdd(user);

    await fillValidFormation(user);
    await choose(user, dialog, "Status", "Concluído");
    await fill(user, "Conclusão", "31122024");
    expect(field("Conclusão").value).toBe("31/12/2024");
    await choose(user, dialog, "Status", "Em andamento");

    expect(field("Conclusão").value).toBe("");
    expect(field("Conclusão").disabled).toBe(true);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Formação adicionada."));
    expect(createFormationMock).toHaveBeenCalledWith(expect.objectContaining({ status: "EM_ANDAMENTO", dataFim: null }));
    expect(screen.queryByText(FORMATION_REVIEW_ERROR)).toBeNull();
  });

  it("keeps the end date when switching between statuses that allow one", async () => {
    const user = userEvent.setup();
    await renderSection([]);
    const dialog = await openFormationAdd(user);

    await choose(user, dialog, "Status", "Concluído");
    await fill(user, "Conclusão", "31122024");
    await choose(user, dialog, "Status", "Trancado");

    expect(field("Conclusão").value).toBe("31/12/2024");
  });

  it("leaves the workload empty and sends null when only letters are typed", async () => {
    const user = userEvent.setup();
    createFormationMock.mockResolvedValue(makeFormation());
    const props = await renderSection([]);
    const dialog = await openFormationAdd(user);

    await fillValidFormation(user);
    await user.type(field("Carga horária"), "abc");

    expect(field("Carga horária").value).toBe("");
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Formação adicionada."));
    expect(createFormationMock).toHaveBeenCalledWith(expect.objectContaining({ cargaHoraria: null }));
  });

  it("clears an optional end date when the field is emptied", async () => {
    const user = userEvent.setup();
    createFormationMock.mockResolvedValue(makeFormation());
    const props = await renderSection([]);
    const dialog = await openFormationAdd(user);

    await fillValidFormation(user);
    await choose(user, dialog, "Status", "Trancado");
    await user.type(field("Conclusão"), "0504");
    await user.clear(field("Conclusão"));
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Formação adicionada."));
    expect(createFormationMock).toHaveBeenCalledWith(expect.objectContaining({ status: "TRANCADO", dataFim: null }));
  });

  it("shows the API error when saving fails and keeps the dialog open", async () => {
    const user = userEvent.setup();
    createFormationMock.mockRejectedValue(new ApiError(422, "Inválido", { title: "Formação recusada pelo servidor" }));
    const props = await renderSection([]);
    const dialog = await openFormationAdd(user);

    await fillValidFormation(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Formação recusada pelo servidor");
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("falls back to the generic save message for an opaque failure", async () => {
    const user = userEvent.setup();
    createFormationMock.mockRejectedValue(undefined);
    await renderSection([]);
    const dialog = await openFormationAdd(user);

    await fillValidFormation(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Não foi possível salvar a formação.");
  });

  it("closes without saving when cancelled", async () => {
    const user = userEvent.setup();
    const props = await renderSection([]);
    const dialog = await openFormationAdd(user);

    await user.click(within(dialog).getByRole("button", { name: CANCEL }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(createFormationMock).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("prefills the edit form and updates the formation by id", async () => {
    const user = userEvent.setup();
    updateFormationMock.mockResolvedValue(makeFormation());
    const props = await renderSection([formationItem(makeFormation({ principal: true, ehRioPombaValley: true, statusValidacaoRpv: "PENDENTE" }))]);

    await user.click(screen.getByRole("button", { name: `Editar ${FORMATION_NAME}` }));
    const dialog = await screen.findByRole("dialog", { name: EDIT_FORMATION_DIALOG });

    expect(field("Nome").value).toBe(FORMATION_NAME);
    expect(field("Instituição").value).toBe(FORMATION_INSTITUTION);
    expect(field("Início").value).toBe("01/03/2020");
    expect(field("Conclusão").value).toBe("15/12/2024");
    expect(field("Carga horária").value).toBe("3600");
    expect(within(dialog).getByRole("combobox", { name: "Status" }).textContent).toBe("Concluído");
    expect((within(dialog).getByRole("switch", { name: "Formação principal" }) as HTMLInputElement).checked).toBe(true);

    await fill(user, "Nome", "Engenharia de Computação");
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Formação atualizada."));
    expect(updateFormationMock).toHaveBeenCalledWith("f-1", {
      tipo: "GRADUACAO",
      nome: "Engenharia de Computação",
      instituicao: FORMATION_INSTITUTION,
      dataInicio: "2020-03-01",
      dataFim: "2024-12-15",
      cargaHoraria: 3600,
      status: "CONCLUIDO",
      principal: true,
      ehRioPombaValley: true,
    });
    expect(createFormationMock).not.toHaveBeenCalled();
  });

  it("opens an in-progress formation without an end date and saves it still open", async () => {
    const user = userEvent.setup();
    updateFormationMock.mockResolvedValue(makeFormation());
    const props = await renderSection([formationItem(makeFormation({ dataFim: null, cargaHoraria: null, status: "EM_ANDAMENTO" }))]);

    await user.click(screen.getByRole("button", { name: `Editar ${FORMATION_NAME}` }));
    const dialog = await screen.findByRole("dialog", { name: EDIT_FORMATION_DIALOG });

    expect(field("Conclusão").value).toBe("");
    expect(field("Carga horária").value).toBe("");
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Formação atualizada."));
    expect(updateFormationMock).toHaveBeenCalledWith("f-1", expect.objectContaining({ dataFim: null, cargaHoraria: null }));
  });

  it("locks the form while the formation is being saved", async () => {
    const user = userEvent.setup();
    const pending = deferred<FormacaoResponse>();
    createFormationMock.mockReturnValue(pending.promise);
    const props = await renderSection([]);
    const dialog = await openFormationAdd(user);

    await fillValidFormation(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("button", { name: "Salvando..." }) as HTMLButtonElement).disabled).toBe(true);

    pending.resolve(makeFormation());
    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Formação adicionada."));
  });

  it("reports the change but shows the load error when refreshing afterwards fails", async () => {
    const user = userEvent.setup();
    createFormationMock.mockResolvedValue(makeFormation());
    const props = await renderSection([]);
    const dialog = await openFormationAdd(user);
    fetchMock.mockRejectedValue(new Error("offline"));

    await fillValidFormation(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Formação adicionada."));
    expect((await screen.findByRole("alert")).textContent).toBe(LOAD_ERROR);
    expect(props.onChanged).toHaveBeenCalledTimes(1);
  });
});

describe("TrajetoriaSection experience form", () => {
  it("opens with professional type and an enabled end date", async () => {
    const user = userEvent.setup();
    await renderSection([]);

    const dialog = await openExperienceAdd(user);

    expect(within(dialog).getByRole("combobox", { name: "Tipo" }).textContent).toBe("Profissional");
    expect(field("Término").disabled).toBe(false);
    expect((within(dialog).getByRole("switch", { name: "Trabalho atual" }) as HTMLInputElement).checked).toBe(false);
  });

  const experienceBase = { Empresa: COMPANY, Cargo: ROLE, Início: "01022023", Término: "31012024" };
  const invalidExperiences: [string, Record<string, string>][] = [
    ["a company name that is too short", { Empresa: "A" }],
    ["a job title that is too short", { Cargo: "B" }],
    ["a missing start date", { Início: "" }],
    ["a start date that does not exist", { Início: "31022023" }],
    ["an incomplete start date", { Início: "0102" }],
    ["an end date that does not exist", { Término: "31022024" }],
    ["an end date before the start date", { Término: "31012023" }],
  ];

  it.each(invalidExperiences)("rejects %s", async (_label, overrides) => {
    const user = userEvent.setup();
    await renderSection([]);
    const dialog = await openExperienceAdd(user);

    for (const [label, value] of Object.entries({ ...experienceBase, ...overrides })) await fill(user, label, value);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(EXPERIENCE_REVIEW_ERROR);
    expect(createExperienceMock).not.toHaveBeenCalled();
  });

  it("creates the experience with trimmed text, ISO dates and a null description", async () => {
    const user = userEvent.setup();
    createExperienceMock.mockResolvedValue(makeExperience());
    const props = await renderSection([]);
    const dialog = await openExperienceAdd(user);

    await fillValidExperience(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Experiência adicionada."));
    expect(createExperienceMock).toHaveBeenCalledWith({
      empresa: COMPANY,
      cargo: ROLE,
      tipo: "PROFISSIONAL",
      dataInicio: "2023-02-01",
      dataFim: "2024-01-31",
      atual: false,
      descricao: null,
    });
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("sends the internship type and the description without emoji", async () => {
    const user = userEvent.setup();
    createExperienceMock.mockResolvedValue(makeExperience());
    const props = await renderSection([]);
    const dialog = await openExperienceAdd(user);

    await fillValidExperience(user);
    await choose(user, dialog, "Tipo", "Estágio");
    await fill(user, "Descrição", "Suporte ao time \u{1F600}de dados");
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Experiência adicionada."));
    expect(createExperienceMock).toHaveBeenCalledWith(expect.objectContaining({ tipo: "ESTAGIO", descricao: "Suporte ao time de dados" }));
  });

  it("turns the description back into null when it is emptied", async () => {
    const user = userEvent.setup();
    createExperienceMock.mockResolvedValue(makeExperience());
    const props = await renderSection([]);
    const dialog = await openExperienceAdd(user);

    await fillValidExperience(user);
    await fill(user, "Descrição", "Texto");
    await fill(user, "Descrição", "");
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Experiência adicionada."));
    expect(createExperienceMock).toHaveBeenCalledWith(expect.objectContaining({ descricao: null }));
  });

  it("clears and disables the end date for a current job and sends it as null", async () => {
    const user = userEvent.setup();
    createExperienceMock.mockResolvedValue(makeExperience());
    const props = await renderSection([]);
    const dialog = await openExperienceAdd(user);

    await fillValidExperience(user);
    await user.click(within(dialog).getByRole("switch", { name: "Trabalho atual" }));

    expect(field("Término").value).toBe("");
    expect(field("Término").disabled).toBe(true);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Experiência adicionada."));
    expect(createExperienceMock).toHaveBeenCalledWith(expect.objectContaining({ atual: true, dataFim: null }));
  });

  it("does not restore the end date when the current-job switch is turned off again", async () => {
    const user = userEvent.setup();
    await renderSection([]);
    const dialog = await openExperienceAdd(user);

    await fill(user, "Término", "31012024");
    await user.click(within(dialog).getByRole("switch", { name: "Trabalho atual" }));
    await user.click(within(dialog).getByRole("switch", { name: "Trabalho atual" }));

    expect(field("Término").disabled).toBe(false);
    expect(field("Término").value).toBe("");
  });

  it("clears an optional end date when the field is emptied", async () => {
    const user = userEvent.setup();
    createExperienceMock.mockResolvedValue(makeExperience());
    const props = await renderSection([]);
    const dialog = await openExperienceAdd(user);

    await fillValidExperience(user);
    await fill(user, "Término", "");
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Experiência adicionada."));
    expect(createExperienceMock).toHaveBeenCalledWith(expect.objectContaining({ dataFim: null, atual: false }));
  });

  it("shows the API error when saving fails and keeps the dialog open", async () => {
    const user = userEvent.setup();
    createExperienceMock.mockRejectedValue(new ApiError(422, "Inválido", { title: "Experiência recusada pelo servidor" }));
    const props = await renderSection([]);
    const dialog = await openExperienceAdd(user);

    await fillValidExperience(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Experiência recusada pelo servidor");
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("falls back to the generic save message for an opaque failure", async () => {
    const user = userEvent.setup();
    createExperienceMock.mockRejectedValue(undefined);
    await renderSection([]);
    const dialog = await openExperienceAdd(user);

    await fillValidExperience(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Não foi possível salvar a experiência.");
  });

  it("closes without saving when cancelled", async () => {
    const user = userEvent.setup();
    await renderSection([]);
    const dialog = await openExperienceAdd(user);

    await user.click(within(dialog).getByRole("button", { name: CANCEL }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(createExperienceMock).not.toHaveBeenCalled();
  });

  it("prefills the edit form and updates the experience by id", async () => {
    const user = userEvent.setup();
    updateExperienceMock.mockResolvedValue(makeExperience());
    const props = await renderSection([experienceItem()]);

    await user.click(screen.getByRole("button", { name: `Editar ${ROLE}` }));
    const dialog = await screen.findByRole("dialog", { name: EDIT_EXPERIENCE_DIALOG });

    expect(field("Empresa").value).toBe(COMPANY);
    expect(field("Cargo").value).toBe(ROLE);
    expect(field("Início").value).toBe("01/02/2023");
    expect(field("Término").value).toBe("31/01/2024");
    expect(field("Descrição").value).toBe("Manutenção de APIs REST.");

    await fill(user, "Cargo", "Desenvolvedora Pleno");
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Experiência atualizada."));
    expect(updateExperienceMock).toHaveBeenCalledWith("e-1", {
      empresa: COMPANY,
      cargo: "Desenvolvedora Pleno",
      tipo: "PROFISSIONAL",
      dataInicio: "2023-02-01",
      dataFim: "2024-01-31",
      atual: false,
      descricao: "Manutenção de APIs REST.",
    });
    expect(createExperienceMock).not.toHaveBeenCalled();
  });

  it("opens a current job with the end date disabled and saves it without one", async () => {
    const user = userEvent.setup();
    updateExperienceMock.mockResolvedValue(makeExperience());
    const props = await renderSection([experienceItem(makeExperience({ atual: true, dataFim: null, descricao: null }))]);

    await user.click(screen.getByRole("button", { name: `Editar ${ROLE}` }));
    const dialog = await screen.findByRole("dialog", { name: EDIT_EXPERIENCE_DIALOG });

    expect(field("Término").disabled).toBe(true);
    expect(field("Descrição").value).toBe("");
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Experiência atualizada."));
    expect(updateExperienceMock).toHaveBeenCalledWith("e-1", expect.objectContaining({ atual: true, dataFim: null, descricao: null }));
  });

  it("locks the form while the experience is being saved", async () => {
    const user = userEvent.setup();
    const pending = deferred<ExperienciaResponse>();
    createExperienceMock.mockReturnValue(pending.promise);
    const props = await renderSection([]);
    const dialog = await openExperienceAdd(user);

    await fillValidExperience(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("button", { name: "Salvando..." }) as HTMLButtonElement).disabled).toBe(true);

    pending.resolve(makeExperience());
    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Experiência adicionada."));
  });
});

describe("TrajetoriaSection delete", () => {
  it("names the formation, warns about its certificate and closes on cancel", async () => {
    const user = userEvent.setup();
    await renderSection([formationItem()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${FORMATION_NAME}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_FORMATION_TITLE });

    expect(within(dialog).getByText(/Você removerá “Engenharia de Software”\./).textContent).toContain("O certificado associado também será removido.");
    await user.click(within(dialog).getByRole("button", { name: CANCEL }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deleteFormationMock).not.toHaveBeenCalled();
  });

  it("deletes a formation after confirmation, then refreshes and announces it", async () => {
    const user = userEvent.setup();
    deleteFormationMock.mockResolvedValue(undefined);
    const props = await renderSection([formationItem()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${FORMATION_NAME}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_FORMATION_TITLE });
    fetchMock.mockResolvedValue([]);
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith(REMOVED_NOTICE));
    expect(deleteFormationMock).toHaveBeenCalledWith("f-1");
    expect(deleteExperienceMock).not.toHaveBeenCalled();
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(FORMATION_EMPTY)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("deletes an experience without the certificate warning", async () => {
    const user = userEvent.setup();
    deleteExperienceMock.mockResolvedValue(undefined);
    const props = await renderSection([experienceItem()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${ROLE}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_EXPERIENCE_TITLE });
    expect(within(dialog).queryByText(/certificado/)).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith(REMOVED_NOTICE));
    expect(deleteExperienceMock).toHaveBeenCalledWith("e-1");
    expect(deleteFormationMock).not.toHaveBeenCalled();
  });

  it("locks the dialog while the item is being deleted", async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    deleteExperienceMock.mockReturnValue(pending.promise);
    const props = await renderSection([experienceItem()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${ROLE}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_EXPERIENCE_TITLE });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect((await within(dialog).findByRole("button", { name: "Excluindo..." }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(dialog).getByRole("button", { name: CANCEL }) as HTMLButtonElement).disabled).toBe(true);

    pending.resolve();
    await waitFor(() => expect(props.notify).toHaveBeenCalledWith(REMOVED_NOTICE));
  });

  it("tells the user to refresh when the item no longer exists", async () => {
    const user = userEvent.setup();
    deleteFormationMock.mockRejectedValue(new ApiError(404, "Não encontrado", { title: "Formação não encontrada" }));
    const props = await renderSection([formationItem()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${FORMATION_NAME}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_FORMATION_TITLE });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Este item já não existe. Atualize a página.");
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("shows the API error title for other deletion failures", async () => {
    const user = userEvent.setup();
    deleteExperienceMock.mockRejectedValue(new ApiError(500, "Erro", { title: "Falha ao remover no servidor" }));
    await renderSection([experienceItem()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${ROLE}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_EXPERIENCE_TITLE });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Falha ao remover no servidor");
    expect((within(dialog).getByRole("button", { name: "Excluir" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("does not show a previous deletion error when another item is opened after cancelling", async () => {
    const user = userEvent.setup();
    deleteFormationMock.mockRejectedValue(new ApiError(500, "Erro", { title: "Falha ao remover no servidor" }));
    await renderSection([formationItem(), experienceItem()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${FORMATION_NAME}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_FORMATION_TITLE });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe("Falha ao remover no servidor");
    await user.click(within(dialog).getByRole("button", { name: CANCEL }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await user.click(screen.getByRole("button", { name: `Excluir ${ROLE}` }));
    const next = await screen.findByRole("dialog", { name: DELETE_EXPERIENCE_TITLE });

    expect(within(next).queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Falha ao remover no servidor")).toBeNull();
  });

  it("clears the previous deletion error when a new deletion starts", async () => {
    const user = userEvent.setup();
    const pending = deferred<void>();
    deleteExperienceMock.mockRejectedValueOnce(new ApiError(500, "Erro", { title: "Falha ao remover no servidor" }));
    deleteExperienceMock.mockReturnValueOnce(pending.promise);
    const props = await renderSection([experienceItem()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${ROLE}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_EXPERIENCE_TITLE });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));
    expect((await within(dialog).findByRole("alert")).textContent).toBe("Falha ao remover no servidor");

    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await within(dialog).findByRole("button", { name: "Excluindo..." });
    expect(within(dialog).queryByRole("alert")).toBeNull();

    pending.resolve();
    await waitFor(() => expect(props.notify).toHaveBeenCalledWith(REMOVED_NOTICE));
  });

  it("falls back to the generic delete message for an opaque failure", async () => {
    const user = userEvent.setup();
    deleteExperienceMock.mockRejectedValue(undefined);
    await renderSection([experienceItem()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${ROLE}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_EXPERIENCE_TITLE });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Não foi possível remover o item.");
  });
});
