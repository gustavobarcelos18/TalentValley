import { screen, within } from "@testing-library/react";
import { renderThemed as render } from "../recruiter/renderThemed";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentHome } from "@/components/student/StudentHome";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import type { MeResponse } from "@/types/student";
import { makeBusca, makeProfile } from "../profile/profileFixtures";

vi.mock("@/hooks/useStudentProfile", () => ({ useStudentProfile: vi.fn() }));

const useStudentProfileMock = vi.mocked(useStudentProfile);
const refreshMock = vi.fn<() => Promise<void>>();

function show(profile: MeResponse | null, overrides: { loading?: boolean; error?: string | null } = {}) {
  useStudentProfileMock.mockReturnValue({
    profile,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    refresh: refreshMock,
  });
}

/** Every section empty, as right after the first login. */
const EMPTY: Partial<MeResponse> = {
  sobre: { bio: null },
  contato: { telefone: null, emailProfissional: null, linkedInUrl: null, gitHubUrl: null, portfolioUrl: null },
  competencias: [],
  idiomas: [],
  disponibilidades: [],
  modalidades: [],
  busca: makeBusca(),
};

describe("StudentHome", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    refreshMock.mockResolvedValue(undefined);
  });

  it("greets the student by first name and shows the privacy notice", () => {
    show(makeProfile());
    render(<StudentHome />);

    expect(screen.getByRole("heading", { level: 1, name: "Olá, Maria" })).toBeTruthy();
    expect(screen.getByText("Perfil privado: só recrutadores aprovados veem.")).toBeTruthy();
  });

  it("links a pending step to its section of the profile and leaves a done step without a link", () => {
    show(makeProfile({ ...EMPTY, sobre: { bio: "Estudante." } }));
    render(<StudentHome />);

    const list = screen.getByRole("list");
    const pending = within(list).getByRole("link", { name: /Contar o que você busca/ });
    expect(pending.getAttribute("href")).toBe("/meu-perfil#secao-busca");
    expect(within(list).queryByRole("link", { name: /Escrever sobre você/ })).toBeNull();
    expect(within(list).getByText(/Escrever sobre você/).textContent).toContain("(feito)");
    expect(pending.textContent).toContain("(pendente)");
  });

  it("shows no percentage, progress bar or counter of the steps", () => {
    show(makeProfile(EMPTY));
    render(<StudentHome />);

    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(document.body.textContent).not.toMatch(/\d+\s*%|\d+\s*de\s*\d+/);
  });

  it("says everything is filled when no step is pending", () => {
    show(
      makeProfile({
        formacoes: [{ id: "f1" } as MeResponse["formacoes"][number]],
        projetos: [{ id: "p1" } as MeResponse["projetos"][number]],
        curriculo: { possuiCurriculo: true, nomeArquivo: "cv.pdf" },
      }),
    );
    render(<StudentHome />);

    expect(screen.getByText(/Tudo preenchido/)).toBeTruthy();
    expect(within(screen.getByRole("list")).queryAllByRole("link")).toHaveLength(0);
  });

  it("explains how recruiters find the student and shows the last update", () => {
    show(makeProfile());
    render(<StudentHome />);

    expect(screen.getByRole("heading", { name: "Como os recrutadores encontram você" })).toBeTruthy();
    expect(screen.getByText(/Perfil atualizado em/)).toBeTruthy();
  });

  it("offers a way to the full profile", () => {
    show(makeProfile());
    render(<StudentHome />);

    expect(screen.getByRole("link", { name: "Ir para o meu perfil" }).getAttribute("href")).toBe("/meu-perfil");
  });

  it("shows skeletons while loading", () => {
    show(null, { loading: true });
    render(<StudentHome />);

    expect(document.querySelectorAll(".MuiSkeleton-root").length).toBeGreaterThan(0);
  });

  it("shows the error with a retry when the profile cannot be loaded", async () => {
    show(null, { error: "Não foi possível carregar seu perfil. Tente novamente." });
    render(<StudentHome />);

    expect(screen.getByRole("alert").textContent).toContain("Não foi possível carregar seu perfil");
    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
