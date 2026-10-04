import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TalentCard } from "@/components/recruiter/TalentCard";
import { ApiError } from "@/lib/api";
import { addFavorite, removeFavorite } from "@/lib/recruiter";
import { makeTalentListItem } from "./recruiterFixtures";

vi.mock("@/hooks/useProtectedFile", () => ({
  useProtectedFile: () => ({ url: null, loading: false, error: null, reload: vi.fn() }),
}));
vi.mock("@/lib/recruiter", () => ({ addFavorite: vi.fn(), removeFavorite: vi.fn() }));

const addMock = vi.mocked(addFavorite);
const removeMock = vi.mocked(removeFavorite);

const NAME = "Maria Souza";
const PREVIEW_LABEL = `Abrir prévia de ${NAME}`;
const VERIFIED_LABEL = "Verificado pelo Rio Pomba Valley";
const NO_LOCATION = "Localização não informada";
const NOT_FOUND = 404;
const MAX_VISIBLE_COMPETENCIES = 6;

afterEach(() => {
  vi.resetAllMocks();
});

describe("TalentCard", () => {
  it("renders the talent summary", () => {
    render(<TalentCard talent={makeTalentListItem({ nomeCompleto: NAME })} />);

    const card = screen.getByRole("article");
    expect(within(card).getByRole("heading", { name: NAME })).toBeTruthy();
    expect(within(card).getByText("Rio Pomba / MG")).toBeTruthy();
    expect(within(card).getByText("Estudante de sistemas de informação.")).toBeTruthy();
    expect(within(card).getByText("Graduação:")).toBeTruthy();
    expect(within(card).getByText(/Sistemas de Informação · IF Sudeste MG/)).toBeTruthy();
    expect(within(card).getByText("React")).toBeTruthy();
    expect(within(card).getByText("Estágio")).toBeTruthy();
    expect(within(card).getByText("Remoto")).toBeTruthy();
    expect(within(card).queryByText(VERIFIED_LABEL)).toBeNull();
  });

  it("shows the verified badge for an RPV verified main formation", () => {
    const formacaoPrincipal = {
      tipo: "TECNICO" as const,
      nome: "Informática",
      instituicao: "Colégio Técnico",
      rpvVerificado: true,
    };
    render(<TalentCard talent={makeTalentListItem({ formacaoPrincipal })} />);

    expect(screen.getByText(VERIFIED_LABEL)).toBeTruthy();
    expect(screen.getByText("Técnico:")).toBeTruthy();
  });

  it("hides optional blocks when the data is missing", () => {
    render(
      <TalentCard
        talent={makeTalentListItem({ cidade: null, uf: null, bio: null, formacaoPrincipal: null, competencias: [], disponibilidades: [], modalidades: [] })}
      />,
    );

    expect(screen.getByText(NO_LOCATION)).toBeTruthy();
    expect(screen.queryByText("Estudante de sistemas de informação.")).toBeNull();
    expect(screen.queryByText("Graduação:")).toBeNull();
    expect(screen.queryByText("React")).toBeNull();
  });

  it("shows only the available part of the location", () => {
    render(<TalentCard talent={makeTalentListItem({ cidade: "Rio Pomba", uf: null })} />);

    expect(screen.getByText("Rio Pomba")).toBeTruthy();
  });

  it("limits visible competencies and summarizes the remainder", () => {
    const competencias = Array.from({ length: MAX_VISIBLE_COMPETENCIES + 2 }, (_, index) => ({ id: index + 1, nome: `Skill ${index + 1}` }));
    render(<TalentCard talent={makeTalentListItem({ competencias })} />);

    expect(screen.getByText(`Skill ${MAX_VISIBLE_COMPETENCIES}`)).toBeTruthy();
    expect(screen.queryByText(`Skill ${MAX_VISIBLE_COMPETENCIES + 1}`)).toBeNull();
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("does not show the remainder chip when competencies fit", () => {
    const competencias = Array.from({ length: MAX_VISIBLE_COMPETENCIES }, (_, index) => ({ id: index + 1, nome: `Skill ${index + 1}` }));
    render(<TalentCard talent={makeTalentListItem({ competencias })} />);

    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  it("omits favorite and comparison controls when no handlers are given", () => {
    render(<TalentCard talent={makeTalentListItem()} />);

    expect(screen.queryByRole("button", { name: /favoritos/ })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Comparar" })).toBeNull();
    expect(screen.getByRole("button", { name: PREVIEW_LABEL })).toBeTruthy();
  });

  it("calls onPreview from the preview button", async () => {
    const onPreview = vi.fn();
    const user = userEvent.setup();
    render(<TalentCard talent={makeTalentListItem({ nomeCompleto: NAME })} onPreview={onPreview} />);

    await user.click(screen.getByRole("button", { name: PREVIEW_LABEL }));

    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it("reports comparison selection changes", async () => {
    const onComparisonChange = vi.fn();
    const user = userEvent.setup();
    render(<TalentCard talent={makeTalentListItem()} comparisonSelected={false} onComparisonChange={onComparisonChange} />);

    const checkbox = screen.getByRole("checkbox", { name: "Comparar" }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    await user.click(checkbox);

    expect(onComparisonChange).toHaveBeenCalledWith(true);
  });

  it("reflects the selected comparison state", () => {
    render(<TalentCard talent={makeTalentListItem()} comparisonSelected onComparisonChange={vi.fn()} />);

    expect((screen.getByRole("checkbox", { name: "Comparar" }) as HTMLInputElement).checked).toBe(true);
  });

  it("treats a missing comparisonSelected as unchecked", () => {
    render(<TalentCard talent={makeTalentListItem()} onComparisonChange={vi.fn()} />);

    expect((screen.getByRole("checkbox", { name: "Comparar" }) as HTMLInputElement).checked).toBe(false);
  });

  it("adds a favorite through the favorite button", async () => {
    addMock.mockResolvedValue(undefined);
    const onFavoriteChange = vi.fn();
    const user = userEvent.setup();
    render(<TalentCard talent={makeTalentListItem({ slug: "maria-souza", nomeCompleto: NAME, favorito: false })} onFavoriteChange={onFavoriteChange} />);

    await user.click(screen.getByRole("button", { name: `Adicionar aos favoritos: ${NAME}` }));

    await waitFor(() => expect(onFavoriteChange).toHaveBeenCalledWith(true));
    expect(addMock).toHaveBeenCalledWith("maria-souza");
  });

  it("removes a favorite when the talent is already favorited", async () => {
    removeMock.mockResolvedValue(undefined);
    const onFavoriteChange = vi.fn();
    const user = userEvent.setup();
    render(<TalentCard talent={makeTalentListItem({ nomeCompleto: NAME, favorito: true })} onFavoriteChange={onFavoriteChange} />);

    await user.click(screen.getByRole("button", { name: `Remover dos favoritos: ${NAME}` }));

    await waitFor(() => expect(onFavoriteChange).toHaveBeenCalledWith(false));
  });

  it("forwards onUnavailable when the favorite request returns 404", async () => {
    addMock.mockRejectedValue(new ApiError(NOT_FOUND, "Not found"));
    const onUnavailable = vi.fn();
    const user = userEvent.setup();
    render(<TalentCard talent={makeTalentListItem({ nomeCompleto: NAME })} onFavoriteChange={vi.fn()} onUnavailable={onUnavailable} />);

    await user.click(screen.getByRole("button", { name: `Adicionar aos favoritos: ${NAME}` }));

    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1));
  });
});
