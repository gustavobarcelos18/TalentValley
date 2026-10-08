import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StudentProfile } from "@/components/profile/StudentProfile";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import type { MeResponse } from "@/types/student";
import { makeProfile } from "./profileFixtures";

vi.mock("@/hooks/useStudentProfile", () => ({
  useStudentProfile: vi.fn(),
}));

const stubs = vi.hoisted(() => {
  // Child sections are stubbed: each renders a marker plus a button that fires `notify`.
  function createStub(name: string) {
    return function Stub(props: {
      profile?: { id: string };
      onChanged?: () => void;
      notify?: (message: string) => void;
    }): ReactElement {
      return (
        <section data-testid={name} data-profile-id={props.profile?.id ?? ""}>
          <button type="button" onClick={() => props.notify?.(`aviso de ${name}`)}>
            notificar {name}
          </button>
          <button type="button" onClick={() => props.onChanged?.()}>
            alterar {name}
          </button>
        </section>
      );
    };
  }
  return { createStub };
});

vi.mock("@/components/profile/ProfileHeader", () => ({ ProfileHeader: stubs.createStub("Header") }));
vi.mock("@/components/profile/DadosBasicosSection", () => ({ DadosBasicosSection: stubs.createStub("DadosBasicos") }));
vi.mock("@/components/profile/SobreSection", () => ({ SobreSection: stubs.createStub("Sobre") }));
vi.mock("@/components/profile/ContatoSection", () => ({ ContatoSection: stubs.createStub("Contato") }));
vi.mock("@/components/profile/TrajetoriaSection", () => ({ TrajetoriaSection: stubs.createStub("Trajetoria") }));
vi.mock("@/components/profile/CompetenciasSection", () => ({ CompetenciasSection: stubs.createStub("Competencias") }));
vi.mock("@/components/profile/IdiomasSection", () => ({ IdiomasSection: stubs.createStub("Idiomas") }));
vi.mock("@/components/profile/DisponibilidadeSection", () => ({ DisponibilidadeSection: stubs.createStub("Disponibilidade") }));
vi.mock("@/components/profile/ProjetosSection", () => ({ ProjetosSection: stubs.createStub("Projetos") }));
vi.mock("@/components/profile/CurriculoSection", () => ({ CurriculoSection: stubs.createStub("Curriculo") }));
vi.mock("@/components/profile/ExclusaoSection", () => ({ ExclusaoSection: stubs.createStub("Exclusao") }));

type HookResult = ReturnType<typeof useStudentProfile>;

const useStudentProfileMock = vi.mocked(useStudentProfile);
const refreshMock = vi.fn<() => Promise<void>>();

const SECTION_ORDER = [
  "Header",
  "DadosBasicos",
  "Sobre",
  "Contato",
  "Trajetoria",
  "Competencias",
  "Idiomas",
  "Disponibilidade",
  "Projetos",
  "Curriculo",
  "Exclusao",
];
const NOTIFYING_SECTIONS = SECTION_ORDER.filter((name) => name !== "Exclusao");
const LOAD_ERROR = "Não foi possível carregar seu perfil. Tente novamente.";
const REFRESH_ERROR = "Não foi possível atualizar o perfil. Tente novamente.";
const RETRY_LABEL = "Tentar novamente";

function mockHook(state: { profile: MeResponse | null; loading: boolean; error: string | null }) {
  const result: HookResult = { ...state, refresh: refreshMock };
  useStudentProfileMock.mockReturnValue(result);
}

function renderedSections(): string[] {
  return Array.from(document.querySelectorAll("section[data-profile-id]")).map(
    (node) => node.getAttribute("data-testid") ?? ""
  );
}

describe("StudentProfile", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    refreshMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("loading state", () => {
    it("shows an accessible spinner and no sections while loading", () => {
      mockHook({ profile: null, loading: true, error: null });

      render(<StudentProfile />);

      expect(screen.getByRole("status", { name: "Carregando perfil" })).toBeTruthy();
      expect(renderedSections()).toEqual([]);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("keeps the loaded sections and hides the error banner while a reload is in flight", () => {
      mockHook({ profile: makeProfile(), loading: true, error: "erro antigo" });

      render(<StudentProfile />);

      expect(screen.getByRole("status", { name: "Carregando perfil" })).toBeTruthy();
      expect(renderedSections()).toHaveLength(SECTION_ORDER.length);
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("initial load error", () => {
    it("shows the error with a retry button wired to refresh", async () => {
      mockHook({ profile: null, loading: false, error: LOAD_ERROR });
      render(<StudentProfile />);

      expect(screen.getByRole("alert").textContent).toBe(LOAD_ERROR);
      expect(renderedSections()).toEqual([]);
      expect(screen.queryByRole("status")).toBeNull();

      await userEvent.click(screen.getByRole("button", { name: RETRY_LABEL }));

      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it("renders nothing but the container when there is no profile, no error and not loading", () => {
      mockHook({ profile: null, loading: false, error: null });

      render(<StudentProfile />);

      expect(renderedSections()).toEqual([]);
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });

  describe("loaded profile", () => {
    it("renders every section in the approved order, each receiving the profile", () => {
      mockHook({ profile: makeProfile({ id: "aluno-42" }), loading: false, error: null });

      render(<StudentProfile />);

      expect(renderedSections()).toEqual(SECTION_ORDER);
      const withProfile = NOTIFYING_SECTIONS.map((name) =>
        screen.getByTestId(name).getAttribute("data-profile-id")
      );
      expect(withProfile).toEqual(NOTIFYING_SECTIONS.map(() => "aluno-42"));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("passes refresh to the sections as onChanged", async () => {
      mockHook({ profile: makeProfile(), loading: false, error: null });
      render(<StudentProfile />);

      await userEvent.click(screen.getByRole("button", { name: "alterar Sobre" }));

      expect(refreshMock).toHaveBeenCalledTimes(1);
    });

    it("shows a warning banner with retry when a refresh failed but the profile is still known", async () => {
      mockHook({ profile: makeProfile(), loading: false, error: REFRESH_ERROR });
      render(<StudentProfile />);

      expect(screen.getByRole("alert").textContent).toContain(REFRESH_ERROR);
      expect(renderedSections()).toHaveLength(SECTION_ORDER.length);

      await userEvent.click(screen.getByRole("button", { name: RETRY_LABEL }));

      expect(refreshMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("notifications", () => {
    beforeEach(() => {
      mockHook({ profile: makeProfile(), loading: false, error: null });
    });

    it("shows no snackbar message before any section notifies", () => {
      render(<StudentProfile />);

      expect(screen.queryByText(/aviso de/)).toBeNull();
    });

    it.each(NOTIFYING_SECTIONS)("shows the message notified by the %s section", async (name) => {
      render(<StudentProfile />);

      await userEvent.click(screen.getByRole("button", { name: `notificar ${name}` }));

      expect(await screen.findByText(`aviso de ${name}`)).toBeTruthy();
    });

    it("hides the message after the auto-hide delay", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      render(<StudentProfile />);
      fireEvent.click(screen.getByRole("button", { name: "notificar Sobre" }));
      expect(screen.getByText("aviso de Sobre")).toBeTruthy();

      await act(async () => {
        vi.advanceTimersByTime(3500);
      });

      await waitFor(() => expect(screen.queryByText("aviso de Sobre")).toBeNull());
    });

    it("keeps the message when the user clicks outside and still hides it after the auto-hide delay", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<StudentProfile />);
      await user.click(screen.getByRole("button", { name: "notificar Sobre" }));
      expect(screen.getByText("aviso de Sobre")).toBeTruthy();

      await user.click(document.body);

      expect(screen.getByText("aviso de Sobre")).toBeTruthy();

      await act(async () => {
        vi.advanceTimersByTime(3500);
      });

      await waitFor(() => expect(screen.queryByText("aviso de Sobre")).toBeNull());
    });

    it("replaces the message with a newer notification after a click outside", async () => {
      const user = userEvent.setup();
      render(<StudentProfile />);
      await user.click(screen.getByRole("button", { name: "notificar Sobre" }));
      await user.click(document.body);
      expect(screen.getByText("aviso de Sobre")).toBeTruthy();

      await user.click(screen.getByRole("button", { name: "notificar Contato" }));

      expect(await screen.findByText("aviso de Contato")).toBeTruthy();
      await waitFor(() => expect(screen.queryByText("aviso de Sobre")).toBeNull());
    });
  });
});
