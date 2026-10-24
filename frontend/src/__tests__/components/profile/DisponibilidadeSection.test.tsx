import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderThemed as render } from "../recruiter/renderThemed";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DisponibilidadeSection } from "@/components/profile/DisponibilidadeSection";
import { confirmBusca, updateDisponibilidade } from "@/lib/student";
import type { UpdateDisponibilidadeRequest } from "@/types/student";
import { makeBusca, makeSectionProps } from "./profileFixtures";
import type { MeResponse } from "@/types/student";

vi.mock("@/lib/student", () => ({ updateDisponibilidade: vi.fn(), confirmBusca: vi.fn() }));

vi.setConfig({ testTimeout: 15_000 });

const mockUpdate = vi.mocked(updateDisponibilidade);
const mockConfirm = vi.mocked(confirmBusca);

const EDIT_LABEL = "Editar o que eu busco";
const SAVE_LABEL = "Salvar";
const EMPTY_MESSAGE = "Conte o que você busca: situação, objetivo, áreas, tipos de vaga e como prefere trabalhar.";
const GENERIC_SAVE_ERROR = "Não foi possível salvar o que você busca. Tente novamente.";
const CONFIRM_LABEL = "Confirmar que continuo assim";
const CONSENT_LABEL = "Autorizo compartilhar esta informação com recrutadores cadastrados";
const DAY_MS = 24 * 60 * 60 * 1000;
const NEXT_YEAR = new Date().getFullYear() + 1;

type User = ReturnType<typeof userEvent.setup>;

function renderSection(overrides: Partial<MeResponse> = {}) {
  const props = makeSectionProps(overrides);
  render(<DisponibilidadeSection {...props} />);
  return props;
}

function agoDays(days: number) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

async function openForm(user: User) {
  await user.click(screen.getByRole("button", { name: EDIT_LABEL }));
  return screen.findByRole("dialog");
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: SAVE_LABEL }));
}

async function toggleOption(user: User, dialog: HTMLElement, combobox: string, option: string) {
  await user.click(within(dialog).getByRole("combobox", { name: combobox }));
  await user.click(await screen.findByRole("option", { name: option }));
  await user.keyboard("{Escape}");
}

/** What the form sends for the default fixture profile (ESTAGIO, REMOTO and nothing else informed). */
function expectedPayload(overrides: Partial<UpdateDisponibilidadeRequest> = {}): UpdateDisponibilidadeRequest {
  return {
    disponibilidades: ["ESTAGIO"],
    modalidades: ["REMOTO"],
    statusBusca: null,
    objetivoProfissional: null,
    areasInteresse: [],
    disponivelImediatamente: false,
    disponivelAPartirDe: null,
    cargaHorariaSemanal: null,
    aceitaViajar: false,
    aceitaMudarDeCidade: false,
    categoriasCnh: [],
    possuiVeiculoProprio: false,
    souPcd: false,
    interesseVagaPcd: false,
    tiposDeficiencia: [],
    consentimentoPcd: false,
    ...overrides,
  };
}

describe("DisponibilidadeSection display", () => {
  beforeEach(() => {
    mockConfirm.mockReset();
    mockConfirm.mockResolvedValue(undefined);
  });

  it("shows a chip for each job type and work mode", () => {
    renderSection({ disponibilidades: ["ESTAGIO", "CLT"], modalidades: ["REMOTO", "HIBRIDO"] });

    for (const label of ["Estágio", "CLT", "Remoto", "Híbrido"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.queryByText("PJ")).toBeNull();
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it("shows the empty state when nothing is informed", () => {
    renderSection({ disponibilidades: [], modalidades: [] });

    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Informar o que eu busco" })).toBeTruthy();
  });

  it("does not show the empty state when only the goal is informed", () => {
    renderSection({ disponibilidades: [], modalidades: [], busca: makeBusca({ objetivo: "Crescer em dados." }) });

    expect(screen.getByText("Crescer em dados.")).toBeTruthy();
    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
  });

  it("opens the form from the empty state action", async () => {
    const user = userEvent.setup();
    renderSection({ disponibilidades: [], modalidades: [] });

    await user.click(screen.getByRole("button", { name: "Informar o que eu busco" }));

    expect(await screen.findByRole("dialog", { name: "Editar o que eu busco" })).toBeTruthy();
  });

  it("shows every informed field with a label", () => {
    renderSection({
      busca: makeBusca({
        status: "BUSCANDO_ATIVAMENTE",
        statusConfirmadoEm: agoDays(1),
        objetivo: "Atuar com dados.",
        areasInteresse: ["DadosAnalytics", "Redes"],
        disponivelAPartirDe: "2099-01-15",
        cargaHoraria: "ATE_30H",
        aceitaViajar: true,
        aceitaMudarDeCidade: true,
        categoriasCnh: ["A", "B"],
        possuiVeiculoProprio: true,
        pcd: { souPcd: true, interesseVagaPcd: true, tipos: ["VISUAL"], consentimentoEm: agoDays(1) },
      }),
    });

    for (const text of [
      "Objetivo profissional",
      "Áreas de interesse",
      "Tipos de vaga",
      "Modalidade de trabalho",
      "Disponível a partir de",
      "Carga horária semanal",
      "Mobilidade",
      "Habilitação",
      "Pessoa com deficiência (PCD)",
      "Buscando ativamente",
      "Atuar com dados.",
      "Dados e analytics",
      "Redes",
      "15/01/2099",
      "Até 30 horas por semana",
      "Aceita viajar a trabalho",
      "Aceita mudar de cidade",
      "CNH A, B",
      "Veículo próprio",
      "Pessoa com deficiência · Visual",
      "Interesse em vagas para PCD",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows Imediato for the immediate flag and for a start date that already passed", () => {
    const { unmount } = render(
      <DisponibilidadeSection {...makeSectionProps({ busca: makeBusca({ disponivelImediatamente: true }) })} />,
    );
    expect(screen.getByText("Imediato")).toBeTruthy();
    unmount();

    renderSection({ busca: makeBusca({ disponivelAPartirDe: "2020-03-01" }) });
    expect(screen.getByText("Imediato")).toBeTruthy();
    expect(screen.queryByText("01/03/2020")).toBeNull();
  });

  it("warns that a student who is not searching still appears to recruiters", () => {
    renderSection({ busca: makeBusca({ status: "NAO_BUSCANDO", statusConfirmadoEm: agoDays(1) }) });

    expect(screen.getByText("Não estou buscando agora")).toBeTruthy();
    expect(screen.getByText(/continua aparecendo para recrutadores/)).toBeTruthy();
  });

  it("warns when the status is outdated", () => {
    renderSection({
      busca: makeBusca({ status: "ABERTO_A_PROPOSTAS", statusConfirmadoEm: agoDays(40), statusDesatualizado: true }),
    });

    expect(screen.getByText(/sem confirmação há mais de 30 dias/)).toBeTruthy();
  });

  it("warns a few days before the status expires", () => {
    renderSection({ busca: makeBusca({ status: "ABERTO_A_PROPOSTAS", statusConfirmadoEm: agoDays(25) }) });

    expect(screen.getByText(/vence em 5 dias/)).toBeTruthy();
  });

  it.each([
    [23, /vence em 7 dias/],
    [29, /vence em 1 dia\./],
    [30, /vence hoje/],
  ])("warns on the edge of the warning window (%s days since the last confirmation)", (days, message) => {
    renderSection({ busca: makeBusca({ status: "ABERTO_A_PROPOSTAS", statusConfirmadoEm: agoDays(days) }) });

    expect(screen.getByText(message)).toBeTruthy();
  });

  it("does not warn one day before the warning window starts", () => {
    renderSection({ busca: makeBusca({ status: "ABERTO_A_PROPOSTAS", statusConfirmadoEm: agoDays(22) }) });

    expect(screen.queryByText(/vence/)).toBeNull();
  });

  it("disables the confirm button while confirming", async () => {
    const user = userEvent.setup();
    let resolveConfirm: () => void = () => undefined;
    mockConfirm.mockReturnValue(new Promise<void>((resolve) => { resolveConfirm = resolve; }));
    const props = renderSection({ busca: makeBusca({ status: "ABERTO_A_PROPOSTAS", statusConfirmadoEm: agoDays(1) }) });

    await user.click(screen.getByRole("button", { name: CONFIRM_LABEL }));

    const pending = await screen.findByRole("button", { name: "Confirmando..." });
    expect(pending.hasAttribute("disabled")).toBe(true);

    resolveConfirm();
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not warn while the status has plenty of time left", () => {
    renderSection({ busca: makeBusca({ status: "ABERTO_A_PROPOSTAS", statusConfirmadoEm: agoDays(10) }) });

    expect(screen.queryByText(/vence/)).toBeNull();
    expect(screen.queryByText(/mais de 30 dias/)).toBeNull();
  });

  it("does not offer to confirm when no status was informed", () => {
    renderSection({ busca: makeBusca({ objetivo: "Crescer." }) });

    expect(screen.queryByRole("button", { name: CONFIRM_LABEL })).toBeNull();
  });

  it("confirms the status, refreshes and notifies", async () => {
    const user = userEvent.setup();
    const props = renderSection({
      busca: makeBusca({ status: "ABERTO_A_PROPOSTAS", statusConfirmadoEm: agoDays(40), statusDesatualizado: true }),
    });

    await user.click(screen.getByRole("button", { name: CONFIRM_LABEL }));

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(props.notify).toHaveBeenCalledWith("Situação de busca confirmada.");
  });

  it("shows the API error when confirming fails", async () => {
    const user = userEvent.setup();
    mockConfirm.mockRejectedValue(new Error("Informe a situação de busca antes de confirmar."));
    const props = renderSection({ busca: makeBusca({ status: "ABERTO_A_PROPOSTAS", statusConfirmadoEm: agoDays(1) }) });

    await user.click(screen.getByRole("button", { name: CONFIRM_LABEL }));

    expect((await screen.findByRole("alert")).textContent).toBe("Informe a situação de busca antes de confirmar.");
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });
});

describe("DisponibilidadeSection form", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(undefined);
  });

  it("opens the dialog with the current values", async () => {
    const user = userEvent.setup();
    renderSection({
      disponibilidades: ["ESTAGIO", "TRAINEE"],
      modalidades: ["REMOTO"],
      busca: makeBusca({
        status: "ABERTO_A_PROPOSTAS",
        objetivo: "Atuar com dados.",
        areasInteresse: ["DadosAnalytics"],
        categoriasCnh: ["B"],
        cargaHoraria: "ATE_20H",
      }),
    });

    const dialog = await openForm(user);

    expect(within(dialog).getByText("Estágio")).toBeTruthy();
    expect(within(dialog).getByText("Trainee")).toBeTruthy();
    expect(within(dialog).getByText("Remoto")).toBeTruthy();
    expect(within(dialog).queryByText("Presencial")).toBeNull();
    expect(within(dialog).getByText("Dados e analytics")).toBeTruthy();
    expect((within(dialog).getByRole("radio", { name: "Aberto a propostas" }) as HTMLInputElement).checked).toBe(true);
    expect((within(dialog).getByLabelText("Objetivo profissional") as HTMLTextAreaElement).value).toBe("Atuar com dados.");
    expect((within(dialog).getByRole("checkbox", { name: "CNH B" }) as HTMLInputElement).checked).toBe(true);
    expect(within(dialog).getByRole("combobox", { name: "Carga horária semanal" }).textContent).toBe(
      "Até 20 horas por semana",
    );
  });

  it("lists the job types and marks the selected ones", async () => {
    const user = userEvent.setup();
    renderSection();
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("combobox", { name: "Tipos de vaga" }));

    const options = await screen.findAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual(["Estágio", "CLT", "PJ", "Freelancer", "Trainee"]);
    expect((within(options[0]).getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    expect((within(options[1]).getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("groups the interest areas by theme", async () => {
    const user = userEvent.setup();
    renderSection();
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("combobox", { name: "Áreas de interesse" }));

    for (const group of [
      "Tecnologia",
      "Gestão de projetos e processos",
      "Inovação e empreendedorismo",
      "Negócios",
      "Marketing, design e comunicação",
    ]) {
      expect(await screen.findByText(group)).toBeTruthy();
    }
    expect((await screen.findAllByRole("option")).length).toBe(35);
  });

  it("blocks a sixth interest area", async () => {
    const user = userEvent.setup();
    renderSection({
      busca: makeBusca({
        areasInteresse: ["DadosAnalytics", "Redes", "DevOps", "BancoDeDados", "Agilidade"],
      }),
    });
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("combobox", { name: "Áreas de interesse" }));

    expect((await screen.findByRole("option", { name: "Audiovisual" })).getAttribute("aria-disabled")).toBe("true");
    expect((await screen.findByRole("option", { name: "Redes" })).getAttribute("aria-disabled")).not.toBe("true");
  });

  it("closes without saving when the user cancels", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    await openForm(user);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it("saves the unchanged values, closes and notifies", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    await openForm(user);

    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(expectedPayload());
    expect(props.notify).toHaveBeenCalledWith("O que você busca foi atualizado.");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("saves newly added job types and work modes using the backend enum values", async () => {
    const user = userEvent.setup();
    const props = renderSection({ disponibilidades: [], modalidades: [] });
    const dialog = await openForm(user);

    await toggleOption(user, dialog, "Tipos de vaga", "CLT");
    await toggleOption(user, dialog, "Tipos de vaga", "Freelancer");
    await toggleOption(user, dialog, "Modalidade de trabalho", "Híbrido");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(
      expectedPayload({ disponibilidades: ["CLT", "FREELANCER"], modalidades: ["HIBRIDO"] }),
    );
  });

  it("removes a selection that is picked again in the list", async () => {
    const user = userEvent.setup();
    const props = renderSection({ disponibilidades: ["ESTAGIO", "PJ"], modalidades: ["REMOTO", "PRESENCIAL"] });
    const dialog = await openForm(user);

    await toggleOption(user, dialog, "Tipos de vaga", "Estágio");
    await toggleOption(user, dialog, "Modalidade de trabalho", "Remoto");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(expectedPayload({ disponibilidades: ["PJ"], modalidades: ["PRESENCIAL"] }));
  });

  it("saves status, goal, areas, hours, mobility and license", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    const dialog = await openForm(user);

    // Plain events for the simple fields keep this long form fast enough under a loaded machine.
    fireEvent.click(within(dialog).getByRole("radio", { name: "Buscando ativamente" }));
    fireEvent.change(within(dialog).getByLabelText("Objetivo profissional"), { target: { value: "Estágio em dados" } });
    await toggleOption(user, dialog, "Áreas de interesse", "Dados e analytics");
    await toggleOption(user, dialog, "Áreas de interesse", "Redes");
    await user.click(within(dialog).getByRole("combobox", { name: "Carga horária semanal" }));
    await user.click(await screen.findByRole("option", { name: "Até 30 horas por semana" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Aceito viajar a trabalho" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Aceito mudar de cidade" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "CNH B" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "CNH E" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Possuo veículo próprio" }));
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(
      expectedPayload({
        statusBusca: "BUSCANDO_ATIVAMENTE",
        objetivoProfissional: "Estágio em dados",
        areasInteresse: ["DadosAnalytics", "Redes"],
        cargaHorariaSemanal: "ATE_30H",
        aceitaViajar: true,
        aceitaMudarDeCidade: true,
        categoriasCnh: ["B", "E"],
        possuiVeiculoProprio: true,
      }),
    );
  });

  it("removes emoji and line breaks from the goal", async () => {
    const user = userEvent.setup();
    renderSection();
    const dialog = await openForm(user);
    const goal = within(dialog).getByLabelText("Objetivo profissional") as HTMLTextAreaElement;

    fireEvent.change(goal, { target: { value: "Quero 🚀 crescer\ncom dados" } });

    expect(goal.value).toBe("Quero  crescer com dados");
  });

  it("saves the immediate availability", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("radio", { name: "Imediato" }));
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(expectedPayload({ disponivelImediatamente: true }));
  });

  it("saves a start date as an ISO date", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("radio", { name: "A partir de uma data" }));
    await user.type(within(dialog).getByLabelText(/Data de início/), `1501${NEXT_YEAR}`);
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(expectedPayload({ disponivelAPartirDe: `${NEXT_YEAR}-01-15` }));
  });

  it("does not save a start date that is missing or invalid", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("radio", { name: "A partir de uma data" }));
    submit();
    expect(await screen.findByText("Informe a data de início.")).toBeTruthy();

    await user.type(within(dialog).getByLabelText(/Data de início/), "31022099");
    submit();
    expect(await screen.findByText("Informe uma data válida.")).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it("turns a past start date into the immediate availability", async () => {
    const user = userEvent.setup();
    const props = renderSection({ busca: makeBusca({ disponivelAPartirDe: "2020-03-01" }) });
    const dialog = await openForm(user);

    expect((within(dialog).getByRole("radio", { name: "Imediato" }) as HTMLInputElement).checked).toBe(true);
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(expectedPayload({ disponivelImediatamente: true }));
  });

  it("asks for the consent before saving PCD information", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    const dialog = await openForm(user);

    expect(within(dialog).queryByRole("checkbox", { name: CONSENT_LABEL })).toBeNull();
    await user.click(within(dialog).getByRole("checkbox", { name: "Tenho interesse em vagas para PCD" }));
    expect(within(dialog).getByRole("checkbox", { name: CONSENT_LABEL })).toBeTruthy();
    submit();

    expect(await screen.findByText("Marque a autorização para salvar as informações PCD.")).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(props.onChanged).not.toHaveBeenCalled();
  });

  it("saves the PCD information with the consent", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("checkbox", { name: "Sou pessoa com deficiência (PCD)" }));
    await toggleOption(user, dialog, "Tipos de deficiência", "Visual");
    await user.click(within(dialog).getByRole("checkbox", { name: "Tenho interesse em vagas para PCD" }));
    await user.click(within(dialog).getByRole("checkbox", { name: CONSENT_LABEL }));
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(
      expectedPayload({ souPcd: true, interesseVagaPcd: true, tiposDeficiencia: ["VISUAL"], consentimentoPcd: true }),
    );
  });

  it("keeps the consent marked when it was already given", async () => {
    const user = userEvent.setup();
    const props = renderSection({
      busca: makeBusca({
        pcd: { souPcd: true, interesseVagaPcd: false, tipos: ["AUDITIVA"], consentimentoEm: agoDays(3) },
      }),
    });
    const dialog = await openForm(user);

    expect((within(dialog).getByRole("checkbox", { name: CONSENT_LABEL }) as HTMLInputElement).checked).toBe(true);
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(
      expectedPayload({ souPcd: true, tiposDeficiencia: ["AUDITIVA"], consentimentoPcd: true }),
    );
  });

  it("clears the PCD information when the student unmarks it", async () => {
    const user = userEvent.setup();
    const props = renderSection({
      busca: makeBusca({
        pcd: { souPcd: true, interesseVagaPcd: true, tipos: ["FISICA"], consentimentoEm: agoDays(3) },
      }),
    });
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("checkbox", { name: "Sou pessoa com deficiência (PCD)" }));
    await user.click(within(dialog).getByRole("checkbox", { name: "Tenho interesse em vagas para PCD" }));
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(expectedPayload());
  });

  it("asks for the consent when only 'Sou PCD' is marked, and drops the types when it is unmarked", async () => {
    const user = userEvent.setup();
    const props = renderSection({
      busca: makeBusca({
        pcd: { souPcd: true, interesseVagaPcd: true, tipos: ["FISICA"], consentimentoEm: agoDays(3) },
      }),
    });
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("checkbox", { name: "Sou pessoa com deficiência (PCD)" }));
    expect(within(dialog).queryByRole("combobox", { name: "Tipos de deficiência" })).toBeNull();
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(
      expectedPayload({ interesseVagaPcd: true, tiposDeficiencia: [], consentimentoPcd: true }),
    );
  });

  it("shows the consent box as soon as 'Sou PCD' is marked", async () => {
    const user = userEvent.setup();
    renderSection();
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("checkbox", { name: "Sou pessoa com deficiência (PCD)" }));

    expect(within(dialog).getByRole("checkbox", { name: CONSENT_LABEL })).toBeTruthy();
  });

  it("removes every control character from the goal", async () => {
    const user = userEvent.setup();
    renderSection();
    const dialog = await openForm(user);
    const goal = within(dialog).getByLabelText("Objetivo profissional") as HTMLTextAreaElement;

    fireEvent.change(goal, { target: { value: "a\u0000b\u007Fc\u0085d" } });

    expect(goal.value).toBe("a b c d");
  });

  it("allows saving everything empty", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    const dialog = await openForm(user);

    await user.click(within(dialog).getByRole("combobox", { name: "Tipos de vaga" }));
    await user.keyboard("{Backspace}");
    await user.click(within(dialog).getByRole("combobox", { name: "Modalidade de trabalho" }));
    await user.keyboard("{Backspace}");
    submit();

    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith(expectedPayload({ disponibilidades: [], modalidades: [] }));
  });

  it("shows the API error message and keeps the dialog open when saving fails", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    mockUpdate.mockRejectedValue(new Error("Perfil bloqueado."));
    await openForm(user);

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe("Perfil bloqueado.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(props.onChanged).not.toHaveBeenCalled();
    expect(props.notify).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the failure carries no message", async () => {
    const user = userEvent.setup();
    renderSection();
    mockUpdate.mockRejectedValue("boom");
    await openForm(user);

    submit();

    expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_SAVE_ERROR);
  });

  it("shows progress while saving and ignores duplicate submits", async () => {
    const user = userEvent.setup();
    const props = renderSection();
    let resolveSave: () => void = () => undefined;
    mockUpdate.mockReturnValue(new Promise<void>((resolve) => { resolveSave = resolve; }));
    await openForm(user);

    submit();

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Salvando..." }).hasAttribute("disabled")).toBe(true);
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    resolveSave();
    await waitFor(() => expect(props.onChanged).toHaveBeenCalledTimes(1));
  });
});
