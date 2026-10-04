import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { TalentPreviewDialog } from "@/components/recruiter/TalentPreviewDialog";
import { ApiError } from "@/lib/api";
import { addFavorite, fetchTalent, removeFavorite } from "@/lib/recruiter";
import type { TalentProfile } from "@/types/recruiter";
import { makeFormation, makeTalentProfile } from "./recruiterFixtures";

vi.mock("@/hooks/useProtectedFile", () => ({
  useProtectedFile: () => ({ url: null, loading: false, error: null, reload: vi.fn() }),
}));
vi.mock("@/lib/recruiter", () => ({ fetchTalent: vi.fn(), addFavorite: vi.fn(), removeFavorite: vi.fn() }));

const fetchMock = vi.mocked(fetchTalent);
const addMock = vi.mocked(addFavorite);
const removeMock = vi.mocked(removeFavorite);

const SLUG = "maria-souza";
const NAME = "Maria Souza";
const NOT_FOUND = 404;
const SERVER_ERROR = 500;
const UNAVAILABLE = "Este perfil não está mais disponível.";
const LOAD_FALLBACK = "Não foi possível carregar a prévia do perfil.";
const MAX_VISIBLE_COMPETENCIES = 8;

interface Handlers {
  onClose: Mock<() => void>;
  onFavoriteChange: Mock<(favorite: boolean) => void>;
  onUnavailable: Mock<() => void>;
}

function renderDialog(props: { open?: boolean; slug?: string | null } = {}): Handlers {
  const handlers: Handlers = { onClose: vi.fn(), onFavoriteChange: vi.fn(), onUnavailable: vi.fn() };
  render(<TalentPreviewDialog open={props.open ?? true} slug={props.slug === undefined ? SLUG : props.slug} {...handlers} />);
  return handlers;
}

async function renderLoaded(profile: TalentProfile = makeTalentProfile()): Promise<Handlers> {
  fetchMock.mockResolvedValue(profile);
  const handlers = renderDialog();
  await screen.findByRole("heading", { name: profile.nomeCompleto });
  return handlers;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("TalentPreviewDialog", () => {
  it("renders nothing and does not fetch while closed", () => {
    renderDialog({ open: false });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not fetch without a slug", () => {
    renderDialog({ slug: null });

    expect(screen.getByRole("dialog", { name: "Prévia do perfil" })).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a loading state while the profile is being fetched", () => {
    fetchMock.mockReturnValue(new Promise<TalentProfile>(() => undefined));
    renderDialog();

    expect(screen.getByText("Carregando perfil…")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith(SLUG);
  });

  it("closes through the close button", async () => {
    const user = userEvent.setup();
    const { onClose } = await renderLoaded();

    await user.click(screen.getByRole("button", { name: "Fechar prévia" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the profile summary with formation, skills and availability", async () => {
    await renderLoaded(
      makeTalentProfile({
        nomeCompleto: NAME,
        formacoes: [makeFormation({ rpvVerificado: true })],
      }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Rio Pomba / MG")).toBeTruthy();
    expect(within(dialog).getByText("Sobre")).toBeTruthy();
    expect(within(dialog).getByText("Estudante de sistemas de informação.")).toBeTruthy();
    expect(within(dialog).getByText("Formação principal")).toBeTruthy();
    expect(within(dialog).getByText("Graduação:")).toBeTruthy();
    expect(within(dialog).getByText("Verificado pelo Rio Pomba Valley")).toBeTruthy();
    expect(within(dialog).getByText("React")).toBeTruthy();
    expect(within(dialog).getByText("Estágio")).toBeTruthy();
    expect(within(dialog).getByText("Remoto")).toBeTruthy();
  });

  it("falls back to the first formation, labelled generically, when none is main", async () => {
    await renderLoaded(
      makeTalentProfile({
        formacoes: [makeFormation({ principal: false, nome: "Curso Alfa" }), makeFormation({ id: "f-2", principal: false, nome: "Curso Beta" })],
      }),
    );

    expect(screen.getByText("Formação")).toBeTruthy();
    expect(screen.getByText(/Curso Alfa/)).toBeTruthy();
    expect(screen.queryByText(/Curso Beta/)).toBeNull();
    expect(screen.queryByText("Verificado pelo Rio Pomba Valley")).toBeNull();
  });

  it("prefers the main formation over earlier ones", async () => {
    await renderLoaded(
      makeTalentProfile({
        formacoes: [makeFormation({ principal: false, nome: "Curso Alfa" }), makeFormation({ id: "f-2", principal: true, nome: "Curso Beta" })],
      }),
    );

    expect(screen.getByText("Formação principal")).toBeTruthy();
    expect(screen.getByText(/Curso Beta/)).toBeTruthy();
    expect(screen.queryByText(/Curso Alfa/)).toBeNull();
  });

  it("shows placeholders when the profile has no optional data", async () => {
    await renderLoaded(
      makeTalentProfile({ bio: null, cidade: null, uf: null, formacoes: [], competencias: [], disponibilidades: [], modalidades: [] }),
    );

    expect(screen.getByText("Localização não informada")).toBeTruthy();
    expect(screen.queryByText("Sobre")).toBeNull();
    expect(screen.queryByText("Formação principal")).toBeNull();
    expect(screen.getByText("Nenhuma competência informada.")).toBeTruthy();
    expect(screen.getByText("Não informado.")).toBeTruthy();
  });

  it("shows availability when only modalities are present", async () => {
    await renderLoaded(makeTalentProfile({ disponibilidades: [], modalidades: ["HIBRIDO"] }));

    expect(screen.getByText("Híbrido")).toBeTruthy();
    expect(screen.queryByText("Não informado.")).toBeNull();
  });

  it("limits the previewed competencies to eight", async () => {
    const competencias = Array.from({ length: MAX_VISIBLE_COMPETENCIES + 2 }, (_, index) => ({ id: index + 1, nome: `Skill ${index + 1}` }));
    await renderLoaded(makeTalentProfile({ competencias }));

    expect(screen.getByText(`Skill ${MAX_VISIBLE_COMPETENCIES}`)).toBeTruthy();
    expect(screen.queryByText(`Skill ${MAX_VISIBLE_COMPETENCIES + 1}`)).toBeNull();
  });

  it("links to the full profile and closes the dialog on click", async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(makeTalentProfile({ slug: SLUG }));
    const onClose = vi.fn();
    // React events bubble through portals; this stops jsdom from attempting a real navigation.
    render(
      <div onClick={(event) => event.preventDefault()}>
        <TalentPreviewDialog open slug={SLUG} onClose={onClose} onFavoriteChange={vi.fn()} onUnavailable={vi.fn()} />
      </div>,
    );
    await screen.findByRole("heading", { name: NAME });

    const link = screen.getByRole("link", { name: /Ver perfil completo/ });
    expect(link.getAttribute("href")).toBe(`/recrutador/talentos/${SLUG}`);
    await user.click(link);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("toggles the favorite and reports the change to the parent", async () => {
    addMock.mockResolvedValue(undefined);
    removeMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    const { onFavoriteChange } = await renderLoaded(makeTalentProfile({ nomeCompleto: NAME, favorito: false }));

    await user.click(screen.getByRole("button", { name: `Adicionar aos favoritos: ${NAME}` }));

    await waitFor(() => expect(onFavoriteChange).toHaveBeenCalledWith(true));
    const removeButton = await screen.findByRole("button", { name: `Remover dos favoritos: ${NAME}` });
    await user.click(removeButton);

    await waitFor(() => expect(onFavoriteChange).toHaveBeenLastCalledWith(false));
    expect(await screen.findByRole("button", { name: `Adicionar aos favoritos: ${NAME}` })).toBeTruthy();
  });

  it("shows the unavailable state when the favorite request finds no profile", async () => {
    addMock.mockRejectedValue(new ApiError(NOT_FOUND, "Not found"));
    const user = userEvent.setup();
    const { onUnavailable } = await renderLoaded(makeTalentProfile({ nomeCompleto: NAME }));

    await user.click(screen.getByRole("button", { name: `Adicionar aos favoritos: ${NAME}` }));

    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy();
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it("shows the unavailable state, notifies the parent and lets the user close on 404", async () => {
    fetchMock.mockRejectedValue(new ApiError(NOT_FOUND, "Not found"));
    const user = userEvent.setup();
    const { onUnavailable, onClose } = renderDialog();

    expect(await screen.findByText(UNAVAILABLE)).toBeTruthy();
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Fechar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows the API error message and retries successfully", async () => {
    fetchMock.mockRejectedValueOnce(new ApiError(SERVER_ERROR, "Falha no servidor")).mockResolvedValueOnce(makeTalentProfile({ nomeCompleto: NAME }));
    const user = userEvent.setup();
    renderDialog();

    expect((await screen.findByRole("alert")).textContent).toContain("Falha no servidor");
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("heading", { name: NAME })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to the generic error message for unknown failures", async () => {
    fetchMock.mockRejectedValue("boom");
    renderDialog();

    expect((await screen.findByRole("alert")).textContent).toContain(LOAD_FALLBACK);
  });

  it("refetches when the slug changes and ignores a stale response", async () => {
    let resolveFirst: (profile: TalentProfile) => void = () => undefined;
    fetchMock
      .mockReturnValueOnce(new Promise<TalentProfile>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(makeTalentProfile({ slug: "joao", nomeCompleto: "João Lima" }));
    const handlers: Handlers = { onClose: vi.fn(), onFavoriteChange: vi.fn(), onUnavailable: vi.fn() };
    const { rerender } = render(<TalentPreviewDialog open slug={SLUG} {...handlers} />);

    rerender(<TalentPreviewDialog open slug="joao" {...handlers} />);
    expect(await screen.findByRole("heading", { name: "João Lima" })).toBeTruthy();
    resolveFirst(makeTalentProfile({ nomeCompleto: NAME }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("heading", { name: NAME })).toBeNull();
  });

  it("ignores a stale failure after the slug changed", async () => {
    let rejectFirst: (reason: unknown) => void = () => undefined;
    fetchMock
      .mockReturnValueOnce(new Promise<TalentProfile>((_, reject) => { rejectFirst = reject; }))
      .mockResolvedValueOnce(makeTalentProfile({ slug: "joao", nomeCompleto: "João Lima" }));
    const handlers: Handlers = { onClose: vi.fn(), onFavoriteChange: vi.fn(), onUnavailable: vi.fn() };
    const { rerender } = render(<TalentPreviewDialog open slug={SLUG} {...handlers} />);

    rerender(<TalentPreviewDialog open slug="joao" {...handlers} />);
    await screen.findByRole("heading", { name: "João Lima" });
    rejectFirst(new ApiError(NOT_FOUND, "Not found"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(handlers.onUnavailable).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "João Lima" })).toBeTruthy();
  });
});
