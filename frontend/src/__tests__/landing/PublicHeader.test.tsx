import type { ComponentProps, ReactNode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicHeader } from "@/components/landing/PublicHeader";
import { navigation } from "@/components/landing/navigation";
import { talentValleyTheme } from "@/theme/theme";
import type { UserRole, UsuarioAutenticado } from "@/types/auth";
import { userWith } from "../components/auth/authMock";

vi.setConfig({ testTimeout: 15_000 });

type Policy = "pending" | "reduced" | "mobile" | "desktop";

const mocks = vi.hoisted(() => ({
  auth: { user: null as UsuarioAutenticado | null },
  photo: { photoPath: null as string | null, reloadKey: 0 },
  policy: "desktop" as Policy,
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/useMyPhoto", () => ({ useMyPhoto: () => mocks.photo }));
vi.mock("@/components/landing/motion/LandingMotion", () => ({ useLandingMotionPolicy: () => mocks.policy }));
vi.mock("@/components/landing/Brand", () => ({ Brand: () => <span>marca</span> }));
vi.mock("@/components/common/UserAvatar", () => ({
  UserAvatar: ({ name, photoPath, reloadKey }: { name: string; photoPath: string | null; reloadKey: number }) => (
    <span data-testid="avatar" data-name={name} data-photo={photoPath ?? ""} data-reload={reloadKey} />
  ),
}));
// Exposes the tap animation so the reduced-motion decision is observable.
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, whileTap, className }: { children: ReactNode; whileTap?: object; className?: string }) => (
      <div className={className} data-while-tap={whileTap ? JSON.stringify(whileTap) : "none"}>{children}</div>
    ),
  },
}));
// Plain anchor that swallows the default navigation, which jsdom does not implement.
vi.mock("next/link", () => ({
  default: ({ href, onClick, ...rest }: ComponentProps<"a">) => (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      {...rest}
    />
  ),
}));

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed: Element[] = [];
  disconnect = vi.fn();
  constructor(readonly callback: IntersectionObserverCallback, readonly options: IntersectionObserverInit) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(target: Element) {
    this.observed.push(target);
  }
}

const HOME_LINK = "Talent Valley — início";
const LOGIN_LINK = "Entrar";
const SWITCH_TO_LIGHT = "Ativar modo claro";
const SWITCH_TO_DARK = "Ativar modo escuro";
const OPEN_MENU = "Abrir menu";
const CLOSE_MENU = "Fechar menu";
const ELEVATED = "is-elevated";
const OPEN_NAV = "is-open";
const TALENTS = "Talentos";
const HOW_IT_WORKS = "Como funciona";
const SECTION_IDS = navigation.map(([id]) => id);
const ROLE_HOME: Record<UserRole, string> = { ALUNO: "/meu-perfil", RECRUTADOR: "/recrutador", ADMIN: "/admin" };

function stubSystemColorScheme(prefersDark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("dark") ? prefersDark : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
}

function addSections(ids: string[]) {
  return ids.map((id) => {
    const section = document.createElement("section");
    section.id = id;
    document.body.appendChild(section);
    return section;
  });
}

function renderHeader() {
  return render(
    <ThemeProvider theme={talentValleyTheme}>
      <PublicHeader />
    </ThemeProvider>,
  );
}

function header() {
  return screen.getByRole("banner");
}

function nav() {
  return screen.getByRole("navigation", { name: "Navegação principal" });
}

function navLink(name: string) {
  return within(nav()).getByRole("link", { name });
}

function currentLabels() {
  return within(nav()).getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "location").map((link) => link.textContent);
}

function observer() {
  const [instance] = FakeIntersectionObserver.instances.slice(-1);
  return instance;
}

function entry(target: Element, isIntersecting: boolean) {
  return { target, isIntersecting } as IntersectionObserverEntry;
}

function report(...entries: IntersectionObserverEntry[]) {
  const current = observer();
  act(() => current.callback(entries, current as unknown as IntersectionObserver));
}

function scrollTo(y: number) {
  vi.stubGlobal("scrollY", y);
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

describe("PublicHeader", () => {
  beforeEach(() => {
    stubSystemColorScheme(true);
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    vi.stubGlobal("scrollY", 0);
    vi.stubGlobal("innerHeight", 700);
    FakeIntersectionObserver.instances = [];
    mocks.auth.user = null;
    mocks.photo = { photoPath: null, reloadKey: 0 };
    mocks.policy = "desktop";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
    document.body.querySelectorAll("section").forEach((section) => section.remove());
  });

  describe("links", () => {
    it("links the brand to the hero", () => {
      renderHeader();
      expect(screen.getByRole("link", { name: HOME_LINK }).getAttribute("href")).toBe("#hero");
      expect(screen.getByText("marca")).toBeTruthy();
    });

    it("lists every landing section in the main navigation, in order", () => {
      renderHeader();
      const links = within(nav()).getAllByRole("link");
      expect(links.map((link) => link.textContent)).toEqual(navigation.map(([, label]) => label));
      expect(links.map((link) => link.getAttribute("href"))).toEqual(SECTION_IDS.map((id) => `#${id}`));
    });
  });

  describe("signed-out visitor", () => {
    it("offers the login button and no account link", () => {
      renderHeader();
      expect(screen.getByRole("link", { name: LOGIN_LINK }).getAttribute("href")).toBe("/login");
      expect(screen.queryByTestId("avatar")).toBeNull();
    });
  });

  describe("signed-in user", () => {
    it.each(Object.entries(ROLE_HOME))("sends a %s to their own area", (role, home) => {
      mocks.auth.user = { ...userWith(role as UserRole), nome: "Ana Souza" };
      renderHeader();
      const link = screen.getByRole("link", { name: "Acessar área de Ana Souza" });
      expect(link.getAttribute("href")).toBe(home);
      expect(screen.queryByRole("link", { name: LOGIN_LINK })).toBeNull();
    });

    it("shows the first name and the avatar with the current photo", () => {
      mocks.auth.user = { ...userWith("ALUNO"), nome: "Ana Souza" };
      mocks.photo = { photoPath: "/api/alunos/me/foto", reloadKey: 3 };
      renderHeader();
      const link = screen.getByRole("link", { name: "Acessar área de Ana Souza" });
      expect(link.querySelector("span:not([data-testid])")?.textContent).toBe("Ana");
      const avatar = within(link).getByTestId("avatar");
      expect(avatar.dataset.name).toBe("Ana Souza");
      expect(avatar.dataset.photo).toBe("/api/alunos/me/foto");
      expect(avatar.dataset.reload).toBe("3");
    });
  });

  describe("theme toggle", () => {
    it("offers light mode when the system is dark and switches back and forth", async () => {
      const user = userEvent.setup();
      renderHeader();
      await user.click(await screen.findByRole("button", { name: SWITCH_TO_LIGHT }));
      await screen.findByRole("button", { name: SWITCH_TO_DARK });

      await user.click(screen.getByRole("button", { name: SWITCH_TO_DARK }));
      await screen.findByRole("button", { name: SWITCH_TO_LIGHT });
    });

    it("offers dark mode when the system is light", async () => {
      stubSystemColorScheme(false);
      renderHeader();
      expect(await screen.findByRole("button", { name: SWITCH_TO_DARK })).toBeTruthy();
      expect(screen.queryByRole("button", { name: SWITCH_TO_LIGHT })).toBeNull();
    });
  });

  describe("tap feedback", () => {
    it.each<Policy>(["pending", "reduced"])("is disabled under the %s motion policy", (policy) => {
      mocks.policy = policy;
      const { container } = renderHeader();
      expect(container.querySelector(".theme-control")?.getAttribute("data-while-tap")).toBe("none");
    });

    it.each<Policy>(["mobile", "desktop"])("shrinks the toggle slightly under the %s motion policy", (policy) => {
      mocks.policy = policy;
      const { container } = renderHeader();
      expect(container.querySelector(".theme-control")?.getAttribute("data-while-tap")).toBe(JSON.stringify({ scale: 0.96 }));
    });
  });

  describe("scroll elevation", () => {
    it("starts flat and elevates once the page scrolls past the threshold", () => {
      renderHeader();
      expect(header().className).not.toContain(ELEVATED);

      scrollTo(24);
      expect(header().className).not.toContain(ELEVATED);

      scrollTo(25);
      expect(header().className).toContain(ELEVATED);

      scrollTo(300);
      expect(header().className).toContain(ELEVATED);

      scrollTo(0);
      expect(header().className).not.toContain(ELEVATED);
    });

    it("is already elevated when mounted below the top", () => {
      vi.stubGlobal("scrollY", 200);
      renderHeader();
      expect(header().className).toContain(ELEVATED);
    });

    it("stops listening to scroll and resize when unmounted", () => {
      addSections(SECTION_IDS);
      const removeListener = vi.spyOn(window, "removeEventListener");
      const { unmount } = renderHeader();
      const current = observer();
      unmount();
      expect(removeListener).toHaveBeenCalledWith("scroll", expect.any(Function));
      expect(removeListener).toHaveBeenCalledWith("resize", expect.any(Function));
      expect(current.disconnect).toHaveBeenCalled();
    });
  });

  describe("mobile menu", () => {
    it("is closed at first", () => {
      renderHeader();
      const toggle = screen.getByRole("button", { name: OPEN_MENU });
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      expect(toggle.getAttribute("aria-controls")).toBe("public-navigation");
      expect(nav().id).toBe("public-navigation");
      expect(nav().className).not.toContain(OPEN_NAV);
    });

    it("opens and closes with the toggle, elevating the header while open", async () => {
      const user = userEvent.setup();
      renderHeader();

      await user.click(screen.getByRole("button", { name: OPEN_MENU }));
      expect(screen.getByRole("button", { name: CLOSE_MENU }).getAttribute("aria-expanded")).toBe("true");
      expect(nav().className).toContain(OPEN_NAV);
      expect(header().className).toContain(ELEVATED);

      await user.click(screen.getByRole("button", { name: CLOSE_MENU }));
      expect(screen.getByRole("button", { name: OPEN_MENU }).getAttribute("aria-expanded")).toBe("false");
      expect(nav().className).not.toContain(OPEN_NAV);
      expect(header().className).not.toContain(ELEVATED);
    });

    it("closes when a navigation link is chosen", async () => {
      const user = userEvent.setup();
      renderHeader();
      await user.click(screen.getByRole("button", { name: OPEN_MENU }));
      await user.click(navLink(TALENTS));
      expect(nav().className).not.toContain(OPEN_NAV);
    });

    it("closes when the brand is chosen", async () => {
      const user = userEvent.setup();
      renderHeader();
      await user.click(screen.getByRole("button", { name: OPEN_MENU }));
      await user.click(screen.getByRole("link", { name: HOME_LINK }));
      expect(nav().className).not.toContain(OPEN_NAV);
    });

    it("closes on Escape and returns focus to the toggle", async () => {
      const user = userEvent.setup();
      renderHeader();
      await user.click(screen.getByRole("button", { name: OPEN_MENU }));
      act(() => navLink(TALENTS).focus());

      await user.keyboard("{Escape}");

      expect(nav().className).not.toContain(OPEN_NAV);
      expect(document.activeElement).toBe(screen.getByRole("button", { name: OPEN_MENU }));
    });

    it("ignores Escape while closed and other keys while open", async () => {
      const user = userEvent.setup();
      renderHeader();
      act(() => navLink(TALENTS).focus());

      await user.keyboard("{Escape}");
      expect(document.activeElement).toBe(navLink(TALENTS));
      expect(nav().className).not.toContain(OPEN_NAV);

      await user.click(screen.getByRole("button", { name: OPEN_MENU }));
      fireEvent.keyDown(navLink(TALENTS), { key: "Enter" });
      expect(nav().className).toContain(OPEN_NAV);
    });
  });

  describe("active section", () => {
    it("marks the hero as current before any section is reported", () => {
      addSections(SECTION_IDS);
      renderHeader();
      expect(currentLabels()).toEqual(["Início"]);
    });

    it("observes a one-pixel band on the active line, only for sections present on the page", () => {
      const sections = addSections([SECTION_IDS[1], SECTION_IDS[3]]);
      renderHeader();
      expect(FakeIntersectionObserver.instances).toHaveLength(1);
      expect(observer().observed).toEqual(sections);
      expect(observer().options.rootMargin).toBe("-120px 0px -579px 0px");
    });

    it("does not observe anything when the page has none of the sections", () => {
      renderHeader();
      expect(FakeIntersectionObserver.instances).toHaveLength(0);
      expect(currentLabels()).toEqual(["Início"]);
    });

    it("follows the section on the active line and falls back to the hero when none is", () => {
      const [, talents] = addSections(SECTION_IDS);
      renderHeader();

      report(entry(talents, true));
      expect(currentLabels()).toEqual([TALENTS]);

      report(entry(talents, false));
      expect(currentLabels()).toEqual(["Início"]);
    });

    it("prefers the lowest section in navigation order when several are reported", () => {
      const [, talents, , howItWorks] = addSections(SECTION_IDS);
      renderHeader();

      report(entry(howItWorks, true), entry(talents, true));
      expect(currentLabels()).toEqual([HOW_IT_WORKS]);

      report(entry(howItWorks, false));
      expect(currentLabels()).toEqual([TALENTS]);
    });

    it("observes again, from scratch, when the viewport is resized", () => {
      const [, talents, , howItWorks] = addSections(SECTION_IDS);
      renderHeader();
      const first = observer();
      report(entry(talents, true));

      vi.stubGlobal("innerHeight", 500);
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      expect(first.disconnect).toHaveBeenCalled();
      expect(FakeIntersectionObserver.instances).toHaveLength(2);
      expect(observer().options.rootMargin).toBe("-120px 0px -379px 0px");
      expect(observer().observed).toHaveLength(SECTION_IDS.length);

      // The previous reading is forgotten: a report about another section must not
      // bring "talents" back as the active one.
      report(entry(howItWorks, false));
      expect(currentLabels()).toEqual(["Início"]);
    });
  });
});
