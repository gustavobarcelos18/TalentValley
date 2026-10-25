import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderThemed as render } from "../recruiter/renderThemed";
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
vi.mock("@/components/profile/SobreSection", () => ({ SobreSection: stubs.createStub("Sobre") }));
vi.mock("@/components/profile/ContatoSection", () => ({ ContatoSection: stubs.createStub("Contato") }));
vi.mock("@/components/profile/TrajetoriaSection", () => ({ TrajetoriaSection: stubs.createStub("Trajetoria") }));
vi.mock("@/components/profile/CompetenciasSection", () => ({ CompetenciasSection: stubs.createStub("Competencias") }));
vi.mock("@/components/profile/IdiomasSection", () => ({ IdiomasSection: stubs.createStub("Idiomas") }));
vi.mock("@/components/profile/DisponibilidadeSection", () => ({ DisponibilidadeSection: stubs.createStub("Disponibilidade") }));
vi.mock("@/components/profile/ProjetosSection", () => ({ ProjetosSection: stubs.createStub("Projetos") }));
vi.mock("@/components/profile/CurriculoSection", () => ({ CurriculoSection: stubs.createStub("Curriculo") }));
vi.mock("@/components/profile/ExclusaoSection", () => ({ ExclusaoSection: stubs.createStub("Exclusao") }));
vi.mock("@/components/account/PrivacidadeSection", () => ({ PrivacidadeSection: stubs.createStub("Privacidade") }));

type HookResult = ReturnType<typeof useStudentProfile>;

const useStudentProfileMock = vi.mocked(useStudentProfile);
const refreshMock = vi.fn<() => Promise<void>>();

const SECTION_ORDER = [
  "Header",
  "Sobre",
  "Contato",
  "Trajetoria",
  "Competencias",
  "Idiomas",
  "Disponibilidade",
  "Projetos",
  "Curriculo",
  "Privacidade",
  "Exclusao",
];
const NOTIFYING_SECTIONS = SECTION_ORDER.filter((name) => name !== "Privacidade" && name !== "Exclusao");
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

function getIndex(): HTMLElement {
  return screen.getByRole("navigation", { name: "Seções do perfil" });
}

interface FakeObserver {
  callback: IntersectionObserverCallback;
  targets: Element[];
}

// jsdom has no IntersectionObserver: this one records what is observed and lets the test fire its callback.
function stubIntersectionObserver(): FakeObserver {
  const fake: FakeObserver = { callback: () => undefined, targets: [] };
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        fake.callback = callback;
      }
      observe(target: Element) {
        fake.targets.push(target);
      }
      disconnect() {
        fake.targets = [];
      }
    },
  );
  return fake;
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
    it("shows an accessible loading placeholder and no sections while loading", () => {
      mockHook({ profile: null, loading: true, error: null });

      render(<StudentProfile />);

      expect(screen.getByRole("status").textContent).toBe("Carregando…");
      expect(renderedSections()).toEqual([]);
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("keeps the loaded sections and hides the error banner while a reload is in flight", () => {
      mockHook({ profile: makeProfile(), loading: true, error: "erro antigo" });

      render(<StudentProfile />);

      expect(screen.getByRole("status").textContent).toBe("Carregando…");
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

  describe("blocks and index", () => {
    const BLOCKS = [
      ["Apresentação", ["Sobre", "Contato"]],
      ["Formação e experiência", ["Trajetoria", "Competencias", "Idiomas"]],
      ["Para os recrutadores", ["Disponibilidade", "Projetos", "Curriculo"]],
    ] as const;
    const ANCHORS = ["sobre", "contato", "trajetoria", "competencias", "idiomas", "busca", "projetos", "curriculo"];

    beforeEach(() => {
      mockHook({ profile: makeProfile(), loading: false, error: null });
    });

    it.each(BLOCKS)("groups the %s sections in one titled block", (title, names) => {
      render(<StudentProfile />);

      const block = screen.getByRole("group", { name: title });

      expect(names.map((name) => within(block).getByTestId(name))).toHaveLength(names.length);
      expect(within(block).getAllByTestId(/.+/)).toHaveLength(names.length);
    });

    it("keeps the header out of the blocks and no longer repeats the basic data card", () => {
      render(<StudentProfile />);

      expect(screen.queryByTestId("DadosBasicos")).toBeNull();
      for (const group of screen.getAllByRole("group")) {
        expect(within(group).queryByTestId("Header")).toBeNull();
      }
    });

    it("gives each section an anchor and links to it from the index", () => {
      render(<StudentProfile />);

      const index = getIndex();
      const hrefs = within(index).getAllByRole("link").map((link) => link.getAttribute("href"));

      expect(hrefs).toEqual(ANCHORS.map((id) => `#secao-${id}`));
      for (const id of ANCHORS) expect(document.getElementById(`secao-${id}`)).not.toBeNull();
    });

    it("names the search section 'O que eu busco' in the index", () => {
      render(<StudentProfile />);

      const index = getIndex();

      expect(within(index).getByRole("link", { name: "O que eu busco" }).getAttribute("href")).toBe("#secao-busca");
    });

    it("marks the first section as the current one before any scroll", () => {
      render(<StudentProfile />);

      const index = getIndex();

      expect(within(index).getByRole("link", { name: "Sobre" }).getAttribute("aria-current")).toBe("location");
      expect(within(index).getAllByRole("link").filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1);
    });

    it("marks the clicked section as the current one", async () => {
      render(<StudentProfile />);
      const index = getIndex();

      await userEvent.click(within(index).getByRole("link", { name: "Projetos" }));

      expect(within(index).getByRole("link", { name: "Projetos" }).getAttribute("aria-current")).toBe("location");
      expect(within(index).getByRole("link", { name: "Sobre" }).hasAttribute("aria-current")).toBe(false);
    });

    describe("with scroll tracking", () => {
      let observer: FakeObserver;

      beforeEach(() => {
        observer = stubIntersectionObserver();
      });

      afterEach(() => {
        vi.unstubAllGlobals();
      });

      function scrollInto(sectionId: string) {
        const target = observer.targets.find((element) => element.id === `secao-${sectionId}`) as Element;
        act(() => observer.callback([{ target, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
      }

      it("follows the section that crosses the reading band while scrolling", () => {
        render(<StudentProfile />);
        expect(observer.targets.map((target) => target.id)).toEqual(ANCHORS.map((id) => `secao-${id}`));

        scrollInto("idiomas");

        expect(within(getIndex()).getByRole("link", { name: "Idiomas" }).getAttribute("aria-current")).toBe("location");
      });

      it.each(["wheel", "touchmove", "pointerdown", "keydown"])(
        "lets go of the clicked section on the first %s, so the index follows the reading again",
        async (eventName) => {
          render(<StudentProfile />);
          await userEvent.click(within(getIndex()).getByRole("link", { name: "Projetos" }));
          scrollInto("idiomas");
          expect(within(getIndex()).getByRole("link", { name: "Projetos" }).getAttribute("aria-current")).toBe("location");

          act(() => {
            globalThis.dispatchEvent(new Event(eventName));
          });

          expect(within(getIndex()).getByRole("link", { name: "Idiomas" }).getAttribute("aria-current")).toBe("location");
        },
      );
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
