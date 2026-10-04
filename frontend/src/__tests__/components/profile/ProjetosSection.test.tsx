import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjetosSection } from "@/components/profile/ProjetosSection";
import { ApiError } from "@/lib/api";
import { createProjeto, deleteProjeto, fetchCompetenciaCatalog, fetchProjetos, updateProjeto } from "@/lib/student";
import type { CatalogoCompetenciaResponse, ProjetoResponse } from "@/types/student";
import { deferred, makeSectionProps } from "./profileFixtures";

vi.mock("@/lib/student");
vi.setConfig({ testTimeout: 15_000 });

const ADD_LABEL = "Adicionar projeto";
const ADD_DIALOG = "Adicionar projeto";
const EDIT_DIALOG = "Editar projeto";
const DELETE_DIALOG = "Excluir projeto?";
const LOAD_ERROR = "Não foi possível carregar os projetos.";
const EMPTY_MESSAGE = "Mostre até dois projetos que melhor representam seu trabalho.";
const FORM_ERROR = "Revise nome, datas, descrição, tecnologias e links. Os links devem começar com http:// ou https://.";
const CATALOG_ERROR = "Não foi possível carregar o catálogo de tecnologias.";
const LIMIT_ERROR = "Você já possui dois projetos em destaque.";
const SAVE_ERROR_FALLBACK = "Não foi possível salvar o projeto.";
const DELETE_ERROR_FALLBACK = "Não foi possível remover o projeto.";
const URL_HELPER_INVALID = "Informe um link completo começando com http:// ou https://.";
const URL_HELPER_DEFAULT = "Opcional. Use um endereço HTTP ou HTTPS.";
const PROJECT_NAME = "Portal de Vagas";
const SECOND_NAME = "Painel de Métricas";
const NEW_NAME = "Meu App";
const NEW_DESCRIPTION = "Aplicativo para organizar estudos.";
const DEMO_URL = "https://demo.example.com";
const REPO_URL = "https://github.com/maria/portal";
const SAVE = "Salvar";

const CATALOG: CatalogoCompetenciaResponse[] = [
  { id: 1, nome: "React" },
  { id: 2, nome: "TypeScript" },
];

const fetchMock = vi.mocked(fetchProjetos);
const catalogMock = vi.mocked(fetchCompetenciaCatalog);
const createMock = vi.mocked(createProjeto);
const updateMock = vi.mocked(updateProjeto);
const deleteMock = vi.mocked(deleteProjeto);

type User = ReturnType<typeof userEvent.setup>;

function makeProject(overrides: Partial<ProjetoResponse> = {}): ProjetoResponse {
  return {
    id: "proj-1",
    ordem: 1,
    nome: PROJECT_NAME,
    dataInicio: "2025-03-01",
    dataFim: "2025-06-30",
    emAndamento: false,
    descricao: "Plataforma de vagas para estudantes.",
    demoUrl: DEMO_URL,
    repositorioUrl: REPO_URL,
    competencias: [{ id: 1, nome: "React" }],
    criadoEm: "2025-03-01T00:00:00Z",
    atualizadoEm: "2025-06-30T00:00:00Z",
    ...overrides,
  };
}

const second = () => makeProject({ id: "proj-2", ordem: 2, nome: SECOND_NAME, demoUrl: null, repositorioUrl: null, competencias: [] });

beforeEach(() => {
  vi.resetAllMocks();
  fetchMock.mockResolvedValue([]);
  catalogMock.mockResolvedValue(CATALOG);
});

async function renderSection(projects: ProjetoResponse[] = []) {
  fetchMock.mockResolvedValue(projects);
  const props = makeSectionProps();
  render(<ProjetosSection {...props} />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  await screen.findByRole("button", { name: ADD_LABEL });
  if (projects.length === 0) await screen.findByText(EMPTY_MESSAGE);
  else await screen.findByText(projects[0].nome);
  return props;
}

const field = (label: string) => screen.getByRole("textbox", { name: new RegExp(`^${label}`) }) as HTMLInputElement | HTMLTextAreaElement;

async function fill(user: User, label: string, value: string) {
  const input = field(label);
  await user.clear(input);
  if (value) {
    await user.click(input);
    await user.paste(value);
  }
}

async function openAddDialog(user: User) {
  await user.click(screen.getByRole("button", { name: ADD_LABEL }));
  const dialog = await screen.findByRole("dialog", { name: ADD_DIALOG });
  await waitFor(() => expect(catalogMock).toHaveBeenCalled());
  return dialog;
}

async function openEditDialog(user: User, name: string) {
  await user.click(screen.getByRole("button", { name: `Editar ${name}` }));
  return screen.findByRole("dialog", { name: EDIT_DIALOG });
}

async function fillValidForm(user: User) {
  await fill(user, "Nome", `  ${NEW_NAME}  `);
  await fill(user, "Início", "10012025");
  await fill(user, "Término", "20022025");
  await fill(user, "Descrição", NEW_DESCRIPTION);
}

describe("ProjetosSection loading and listing", () => {
  it("disables the add action while the projects are loading", async () => {
    const pending = deferred<ProjetoResponse[]>();
    fetchMock.mockReturnValue(pending.promise);
    render(<ProjetosSection {...makeSectionProps()} />);

    expect((screen.getByRole("button", { name: ADD_LABEL }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();

    pending.resolve([]);
    expect(await screen.findByText(EMPTY_MESSAGE)).toBeTruthy();
    expect((screen.getByRole("button", { name: ADD_LABEL }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the load error and keeps the add action disabled when the fetch fails", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<ProjetosSection {...makeSectionProps()} />);

    expect((await screen.findByRole("alert")).textContent).toBe(LOAD_ERROR);
    expect((screen.getByRole("button", { name: ADD_LABEL }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the empty prompt when there are no projects", async () => {
    await renderSection([]);

    expect(screen.getByRole("heading", { name: "Projetos em destaque" })).toBeTruthy();
    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
  });

  it("lists projects ordered by position with technologies and links", async () => {
    await renderSection([second(), makeProject()]);

    const labels = screen.getAllByText(/^Projeto em destaque \d$/).map((node) => node.textContent);
    expect(labels).toEqual(["Projeto em destaque 1", "Projeto em destaque 2"]);
    expect(screen.getByText("React")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Demo/ }).getAttribute("href")).toBe(DEMO_URL);
    expect(screen.getByRole("link", { name: /Repositório/ }).getAttribute("href")).toBe(REPO_URL);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it("disables the add action once two projects exist", async () => {
    await renderSection([makeProject(), second()]);

    expect((screen.getByRole("button", { name: ADD_LABEL }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("ProjetosSection add form", () => {
  it("suggests position 1 when no project exists yet", async () => {
    const user = userEvent.setup();
    await renderSection([]);
    const dialog = await openAddDialog(user);
    expect(within(dialog).getByRole("combobox", { name: "Posição" }).textContent).toBe("Destaque 1");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("suggests position 2 when position 1 is already occupied", async () => {
    const user = userEvent.setup();
    await renderSection([makeProject()]);

    const dialog = await openAddDialog(user);

    expect(within(dialog).getByRole("combobox", { name: "Posição" }).textContent).toBe("Destaque 2");
  });

  it("rejects an empty submission with the review message and no API call", async () => {
    const user = userEvent.setup();
    await renderSection([]);
    const dialog = await openAddDialog(user);

    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(FORM_ERROR);
    expect(createMock).not.toHaveBeenCalled();
  });

  const invalidSubmissions: [string, Record<string, string>][] = [
    ["a project name that is too short", { Nome: "A" }],
    ["an incomplete start date", { Início: "0101" }],
    ["a start date that does not exist", { Início: "31022025" }],
    ["an end date that does not exist", { Término: "31022025" }],
    ["an end date before the start date", { Início: "10012025", Término: "09012025" }],
    ["a missing description", { Descrição: "" }],
    ["a non-http demo link", { "Link da demo": "ftp://servidor.example.com" }],
    ["a malformed repository link", { "Link do repositório": "isso nao e url" }],
  ];

  it.each(invalidSubmissions)("rejects %s", async (_label, overrides) => {
    const user = userEvent.setup();
    await renderSection([]);
    const dialog = await openAddDialog(user);
    const values: Record<string, string> = { Nome: NEW_NAME, Início: "10012025", Término: "20022025", Descrição: NEW_DESCRIPTION, ...overrides };

    for (const [label, value] of Object.entries(values)) await fill(user, label, value);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(FORM_ERROR);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("creates the project with trimmed values, ISO dates and null optional links", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue(makeProject());
    const props = await renderSection([]);
    const dialog = await openAddDialog(user);

    await fillValidForm(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Projeto adicionado."));
    expect(createMock).toHaveBeenCalledWith({
      ordem: 1,
      nome: NEW_NAME,
      dataInicio: "2025-01-10",
      dataFim: "2025-02-20",
      emAndamento: false,
      descricao: NEW_DESCRIPTION,
      demoUrl: null,
      repositorioUrl: null,
      competenciaIds: [],
    });
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("sends the chosen position, links and technologies", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue(makeProject());
    const props = await renderSection([]);
    const dialog = await openAddDialog(user);

    await fillValidForm(user);
    await fill(user, "Link da demo", ` ${DEMO_URL} `);
    await fill(user, "Link do repositório", REPO_URL);
    await user.click(within(dialog).getByRole("combobox", { name: "Posição" }));
    await user.click(await screen.findByRole("option", { name: "Destaque 2" }));
    await user.click(within(dialog).getByRole("combobox", { name: "Tecnologias" }));
    await user.click(await screen.findByRole("option", { name: "TypeScript" }));
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Projeto adicionado."));
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      ordem: 2,
      demoUrl: DEMO_URL,
      repositorioUrl: REPO_URL,
      competenciaIds: [2],
    }));
  });

  it("masks typed dates as dd/mm/aaaa and keeps only digits", async () => {
    const user = userEvent.setup();
    await renderSection([]);
    await openAddDialog(user);

    await user.type(field("Início"), "1a0/0b12025999");
    await user.type(field("Término"), "0501");

    expect(field("Início").value).toBe("10/01/2025");
    expect(field("Término").value).toBe("05/01");
  });

  it("clears the end date when the project is marked as ongoing and sends it as null", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue(makeProject());
    const props = await renderSection([]);
    const dialog = await openAddDialog(user);

    await fillValidForm(user);
    await user.click(within(dialog).getByRole("switch", { name: "Projeto em andamento" }));

    expect(field("Término").value).toBe("");
    expect(field("Término").disabled).toBe(true);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Projeto adicionado."));
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ emAndamento: true, dataFim: null }));
  });

  it("shows live counters, field errors and strips emoji from the description", async () => {
    const user = userEvent.setup();
    await renderSection([]);
    await openAddDialog(user);

    expect(screen.getByText("0/1000")).toBeTruthy();
    expect(field("Nome").getAttribute("aria-invalid")).toBe("false");

    await fill(user, "Nome", "A");
    expect(field("Nome").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Informe um nome de projeto válido.")).toBeTruthy();

    await fill(user, "Nome", NEW_NAME);
    expect(field("Nome").getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByText(`${NEW_NAME.length}/200`)).toBeTruthy();

    await fill(user, "Descrição", "Texto \u{1F600}ok");
    expect(field("Descrição").value).toBe("Texto ok");
  });

  it("flags invalid links as the user types and falls back to the neutral hint when empty", async () => {
    const user = userEvent.setup();
    await renderSection([]);
    await openAddDialog(user);

    expect(screen.getAllByText(URL_HELPER_DEFAULT)).toHaveLength(2);

    await fill(user, "Link da demo", "ftp://x.example.com");
    await fill(user, "Link do repositório", "nao-e-url");
    expect(screen.getAllByText(URL_HELPER_INVALID)).toHaveLength(2);
    expect(field("Link da demo").getAttribute("aria-invalid")).toBe("true");

    await fill(user, "Link da demo", "");
    expect(field("Link da demo").getAttribute("aria-invalid")).toBe("false");
    expect(screen.getAllByText(URL_HELPER_INVALID)).toHaveLength(1);
  });

  it("maps a 409 conflict to the two-project limit message and keeps the dialog open", async () => {
    const user = userEvent.setup();
    createMock.mockRejectedValue(new ApiError(409, "Conflito", { title: "Conflito no servidor" }));
    const props = await renderSection([]);
    const dialog = await openAddDialog(user);

    await fillValidForm(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(LIMIT_ERROR);
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: ADD_DIALOG })).toBeTruthy();
  });

  it("shows the API error title for other failures", async () => {
    const user = userEvent.setup();
    createMock.mockRejectedValue(new ApiError(422, "Inválido", { title: "Projeto inválido segundo o servidor" }));
    await renderSection([]);
    const dialog = await openAddDialog(user);

    await fillValidForm(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Projeto inválido segundo o servidor");
  });

  it("falls back to the generic save message for an opaque failure", async () => {
    const user = userEvent.setup();
    createMock.mockRejectedValue("falha");
    await renderSection([]);
    const dialog = await openAddDialog(user);

    await fillValidForm(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(SAVE_ERROR_FALLBACK);
  });

  it("shows a warning when the technology catalog cannot be loaded", async () => {
    const user = userEvent.setup();
    catalogMock.mockRejectedValue(new Error("offline"));
    await renderSection([]);
    const dialog = await openAddDialog(user);

    expect((await within(dialog).findByRole("alert")).textContent).toBe(CATALOG_ERROR);
  });

  it("closes without saving when cancelled", async () => {
    const user = userEvent.setup();
    const props = await renderSection([]);
    const dialog = await openAddDialog(user);

    await fill(user, "Nome", NEW_NAME);
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(createMock).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("locks the form while the project is being saved", async () => {
    const user = userEvent.setup();
    const pending = deferred<ProjetoResponse>();
    createMock.mockReturnValue(pending.promise);
    const props = await renderSection([]);
    const dialog = await openAddDialog(user);

    await fillValidForm(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    const saving = await within(dialog).findByRole("button", { name: "Salvando..." });
    expect((saving as HTMLButtonElement).disabled).toBe(true);

    pending.resolve(makeProject());
    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Projeto adicionado."));
  });

  it("still reports the change when refreshing the list afterwards fails", async () => {
    const user = userEvent.setup();
    createMock.mockResolvedValue(makeProject());
    const props = await renderSection([]);
    const dialog = await openAddDialog(user);
    fetchMock.mockRejectedValue(new Error("offline"));

    await fillValidForm(user);
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Projeto adicionado."));
    expect((await screen.findByRole("alert")).textContent).toBe(LOAD_ERROR);
    expect(props.onChanged).toHaveBeenCalledTimes(1);
  });
});

describe("ProjetosSection edit form", () => {
  it("prefills the form with the project's current values", async () => {
    const user = userEvent.setup();
    await renderSection([makeProject()]);

    const dialog = await openEditDialog(user, PROJECT_NAME);

    expect(field("Nome").value).toBe(PROJECT_NAME);
    expect(field("Início").value).toBe("01/03/2025");
    expect(field("Término").value).toBe("30/06/2025");
    expect(field("Descrição").value).toBe("Plataforma de vagas para estudantes.");
    expect(field("Link da demo").value).toBe(DEMO_URL);
    expect(field("Link do repositório").value).toBe(REPO_URL);
    expect(within(dialog).getByRole("combobox", { name: "Posição" }).textContent).toBe("Destaque 1");
    expect(within(dialog).getByText("React")).toBeTruthy();
  });

  it("updates the project with the edited values, then reports the change", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue(makeProject());
    const props = await renderSection([makeProject()]);
    const dialog = await openEditDialog(user, PROJECT_NAME);

    await fill(user, "Nome", "Portal de Vagas 2");
    await fill(user, "Link da demo", "");
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Projeto atualizado."));
    expect(updateMock).toHaveBeenCalledWith("proj-1", {
      ordem: 1,
      nome: "Portal de Vagas 2",
      dataInicio: "2025-03-01",
      dataFim: "2025-06-30",
      emAndamento: false,
      descricao: "Plataforma de vagas para estudantes.",
      demoUrl: null,
      repositorioUrl: REPO_URL,
      competenciaIds: [1],
    });
    expect(createMock).not.toHaveBeenCalled();
    expect(props.onChanged).toHaveBeenCalledTimes(1);
  });

  it("opens an ongoing project with the end date disabled and saves it without one", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue(makeProject());
    const props = await renderSection([makeProject({ emAndamento: true, dataFim: null })]);
    const dialog = await openEditDialog(user, PROJECT_NAME);

    expect(field("Término").disabled).toBe(true);
    expect((within(dialog).getByRole("switch", { name: "Projeto em andamento" }) as HTMLInputElement).checked).toBe(true);

    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Projeto atualizado."));
    expect(updateMock).toHaveBeenCalledWith("proj-1", expect.objectContaining({ emAndamento: true, dataFim: null }));
  });

  it("restores editing of the end date when the ongoing switch is turned off", async () => {
    const user = userEvent.setup();
    await renderSection([makeProject({ emAndamento: true, dataFim: null })]);
    const dialog = await openEditDialog(user, PROJECT_NAME);

    await user.click(within(dialog).getByRole("switch", { name: "Projeto em andamento" }));

    expect(field("Término").disabled).toBe(false);
  });

  it("removes a selected technology and sends the remaining ids", async () => {
    const user = userEvent.setup();
    updateMock.mockResolvedValue(makeProject());
    const props = await renderSection([makeProject({ competencias: [{ id: 1, nome: "React" }, { id: 2, nome: "TypeScript" }] })]);
    const dialog = await openEditDialog(user, PROJECT_NAME);

    await user.click(within(dialog).getByRole("combobox", { name: "Tecnologias" }));
    await user.keyboard("{Backspace}");
    await user.click(within(dialog).getByRole("button", { name: SAVE }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Projeto atualizado."));
    expect(updateMock).toHaveBeenCalledWith("proj-1", expect.objectContaining({ competenciaIds: [1] }));
  });
});

describe("ProjetosSection delete", () => {
  it("asks for confirmation naming the project and closes on cancel", async () => {
    const user = userEvent.setup();
    await renderSection([makeProject()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${PROJECT_NAME}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_DIALOG });
    expect(within(dialog).getByText(`Você removerá “${PROJECT_NAME}”.`)).toBeTruthy();

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("deletes the project after confirmation, then refreshes and reports the change", async () => {
    const user = userEvent.setup();
    deleteMock.mockResolvedValue(undefined);
    const props = await renderSection([makeProject()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${PROJECT_NAME}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_DIALOG });
    fetchMock.mockResolvedValue([]);
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    await waitFor(() => expect(props.notify).toHaveBeenCalledWith("Projeto removido."));
    expect(deleteMock).toHaveBeenCalledWith("proj-1");
    expect(props.onChanged).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(EMPTY_MESSAGE)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows the API error inside the dialog when the deletion fails", async () => {
    const user = userEvent.setup();
    deleteMock.mockRejectedValue(new ApiError(500, "Erro", { title: "Falha ao remover no servidor" }));
    const props = await renderSection([makeProject()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${PROJECT_NAME}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_DIALOG });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe("Falha ao remover no servidor");
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
    expect((within(dialog).getByRole("button", { name: "Excluir" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("falls back to the generic delete message for an opaque failure", async () => {
    const user = userEvent.setup();
    deleteMock.mockRejectedValue(undefined);
    await renderSection([makeProject()]);

    await user.click(screen.getByRole("button", { name: `Excluir ${PROJECT_NAME}` }));
    const dialog = await screen.findByRole("dialog", { name: DELETE_DIALOG });
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));

    expect((await within(dialog).findByRole("alert")).textContent).toBe(DELETE_ERROR_FALLBACK);
  });
});
