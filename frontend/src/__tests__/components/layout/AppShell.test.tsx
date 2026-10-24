import type { ComponentProps } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@mui/material/styles";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { talentValleyTheme } from "@/theme/theme";
import type { UserRole, UsuarioAutenticado } from "@/types/auth";
import { userWith } from "../auth/authMock";

vi.setConfig({ testTimeout: 15_000 });

const mocks = vi.hoisted(() => ({
  auth: { user: null as UsuarioAutenticado | null, logout: vi.fn() },
  photo: { photoPath: null as string | null, reloadKey: 0 },
  pathname: "/",
  router: { replace: vi.fn() },
  protectedFile: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/hooks/useMyPhoto", () => ({ useMyPhoto: () => mocks.photo }));
vi.mock("@/hooks/useProtectedFile", () => ({ useProtectedFile: mocks.protectedFile }));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => mocks.router,
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

const PAGE_CONTENT = "conteúdo da página";
const USER_NAME = "Ana Souza";
const PHOTO_PATH = "/api/alunos/me/foto";
const PHOTO_URL = "blob:http://localhost/foto";
const CHANGE_PASSWORD = "/conta/senha";
const LOGIN = "/login";
const SWITCH_TO_LIGHT = "Ativar modo claro";
const SWITCH_TO_DARK = "Ativar modo escuro";
const ACCOUNT_TRIGGER = `Menu da conta de ${USER_NAME}`;

const NAV_LABELS: Record<UserRole, string[]> = {
  ALUNO: ["Meu perfil"],
  RECRUTADOR: ["Visão geral", "Explorar talentos", "Favoritos"],
  ADMIN: ["Visão geral", "Solicitações", "Alunos", "Recrutadores", "Validações RPV", "Auditoria"],
};
const ROLE_LABEL: Record<UserRole, string> = { ALUNO: "Aluno", RECRUTADOR: "Recrutador", ADMIN: "Admin" };
const BRAND_NAME = "Talent Valley — ir para a página inicial";
const LANDING = "/";
const COLLAPSE = "Recolher menu lateral";
const EXPAND = "Expandir menu lateral";
const ROLES = Object.keys(NAV_LABELS) as UserRole[];

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

function signIn(role: UserRole | null, pathname = "/") {
  mocks.auth.user = role ? { ...userWith(role), nome: USER_NAME } : null;
  mocks.pathname = pathname;
}

function shellTree() {
  return (
    <ThemeProvider theme={talentValleyTheme}>
      <AppShell>
        <p>{PAGE_CONTENT}</p>
      </AppShell>
    </ThemeProvider>
  );
}

function renderShell() {
  return render(shellTree());
}

// Like stubSystemColorScheme, but the width of the screen can change while the test runs:
// `setDesktop(true)` makes it as wide as a desktop (lg breakpoint and up) and tells the listeners.
function stubResizableScreen(startsDesktop: boolean) {
  let desktop = startsDesktop;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("min-width") ? desktop : query.includes("dark");
    },
    media: query,
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  return {
    setDesktop(next: boolean) {
      desktop = next;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

function navLink(name: string) {
  return screen.getByRole("link", { name });
}

function isSelected(element: HTMLElement) {
  return element.classList.contains("Mui-selected");
}

async function openDrawer() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Abrir menu" }));
  await screen.findByRole("button", { name: "Fechar menu" });
  return user;
}

function drawer() {
  return within(screen.getByRole("presentation"));
}

async function waitForDrawerToClose() {
  await waitFor(() => expect(screen.queryByRole("button", { name: "Fechar menu" })).toBeNull());
}

async function openAccountMenu() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: ACCOUNT_TRIGGER }));
  return { user, menu: await screen.findByRole("menu") };
}

describe("AppShell", () => {
  beforeEach(() => {
    stubSystemColorScheme(true);
    signIn("ALUNO");
    mocks.photo = { photoPath: null, reloadKey: 0 };
    mocks.auth.logout = vi.fn().mockResolvedValue(undefined);
    mocks.router.replace.mockReset();
    mocks.protectedFile.mockReset();
    mocks.protectedFile.mockImplementation((path: string | null) => ({ url: path ? PHOTO_URL : null }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  describe("page content", () => {
    it("renders the children inside the main landmark", () => {
      renderShell();

      expect(within(screen.getByRole("main")).getByText(PAGE_CONTENT)).not.toBeNull();
    });
  });

  describe("navigation by role", () => {
    it.each(ROLES)("shows exactly the %s navigation links", (role) => {
      signIn(role);
      renderShell();

      const labels = screen
        .getAllByRole("link")
        .map((link) => link.textContent)
        .filter((text) => text !== "Talent Valley");
      expect(labels).toEqual(NAV_LABELS[role]);
    });

    it("points each recruiter link to its own route", () => {
      signIn("RECRUTADOR");
      renderShell();

      expect(navLink("Explorar talentos").getAttribute("href")).toBe("/recrutador/talentos");
      expect(navLink("Favoritos").getAttribute("href")).toBe("/recrutador/favoritos");
    });

    it("points each admin link to its own route", () => {
      signIn("ADMIN");
      renderShell();

      expect(navLink("Solicitações").getAttribute("href")).toBe("/admin/solicitacoes");
      expect(navLink("Validações RPV").getAttribute("href")).toBe("/admin/validacoes-rpv");
      expect(navLink("Auditoria").getAttribute("href")).toBe("/admin/auditoria");
    });

    it("shows the role label of the signed-in user", () => {
      signIn("RECRUTADOR");
      renderShell();

      expect(screen.getByText(ROLE_LABEL.RECRUTADOR)).not.toBeNull();
    });
  });

  describe("brand link", () => {
    it.each(ROLES)("leads %s users to the landing page, not to their role home", (role) => {
      signIn(role, "/qualquer/rota");
      renderShell();

      expect(screen.getAllByRole("link", { name: BRAND_NAME })[0].getAttribute("href")).toBe(LANDING);
    });

    it("is offered in the side menu and in the mobile top bar", () => {
      renderShell();

      expect(screen.getAllByRole("link", { name: BRAND_NAME })).toHaveLength(2);
    });

    it("still leads to the landing page while there is no signed-in user", () => {
      signIn(null);
      renderShell();

      expect(screen.getAllByRole("link", { name: BRAND_NAME })[0].getAttribute("href")).toBe(LANDING);
    });
  });

  describe("collapsible side menu", () => {
    it("starts expanded with the labels visible", () => {
      renderShell();

      expect(screen.getByRole("button", { name: COLLAPSE }).getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByText("Meu perfil")).not.toBeNull();
    });

    it("collapses to icons, keeps every link reachable by name and remembers the choice", async () => {
      signIn("RECRUTADOR");
      const user = userEvent.setup();
      renderShell();

      await user.click(screen.getByRole("button", { name: COLLAPSE }));

      expect(screen.getByRole("button", { name: EXPAND }).getAttribute("aria-expanded")).toBe("false");
      for (const label of NAV_LABELS.RECRUTADOR) {
        expect(navLink(label)).not.toBeNull();
      }
      expect(window.localStorage.getItem("tv-sidebar-collapsed")).toBe("1");
    });

    it("hides the user name and role when collapsed, keeping the account button named", async () => {
      const user = userEvent.setup();
      renderShell();

      await user.click(screen.getByRole("button", { name: COLLAPSE }));

      expect(screen.queryByText(ROLE_LABEL.ALUNO)).toBeNull();
      expect(screen.getByRole("button", { name: ACCOUNT_TRIGGER })).not.toBeNull();
    });

    it("expands again and stores the new choice", async () => {
      const user = userEvent.setup();
      renderShell();

      await user.click(screen.getByRole("button", { name: COLLAPSE }));
      await user.click(screen.getByRole("button", { name: EXPAND }));

      expect(screen.getByRole("button", { name: COLLAPSE })).not.toBeNull();
      expect(window.localStorage.getItem("tv-sidebar-collapsed")).toBe("0");
    });

    it("opens collapsed when the browser remembered the choice", () => {
      window.localStorage.setItem("tv-sidebar-collapsed", "1");
      renderShell();

      expect(screen.getByRole("button", { name: EXPAND })).not.toBeNull();
    });

    it("still collapses and expands when the browser blocks storage", async () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      const user = userEvent.setup();
      renderShell();
      const toggle = () => screen.getByRole("button", { name: /menu lateral$/ });
      const before = toggle().getAttribute("aria-label");

      await user.click(toggle());
      expect(toggle().getAttribute("aria-label")).not.toBe(before);

      await user.click(toggle());
      expect(toggle().getAttribute("aria-label")).toBe(before);
    });

    it("shows a tooltip with the page name over each icon when collapsed", async () => {
      signIn("RECRUTADOR");
      window.localStorage.setItem("tv-sidebar-collapsed", "1");
      const user = userEvent.setup();
      renderShell();

      await user.hover(navLink("Favoritos"));

      expect((await screen.findByRole("tooltip")).textContent).toBe("Favoritos");
    });

    it("shows a tooltip with the user name over the avatar when collapsed", async () => {
      window.localStorage.setItem("tv-sidebar-collapsed", "1");
      const user = userEvent.setup();
      renderShell();

      await user.hover(screen.getByRole("button", { name: ACCOUNT_TRIGGER }));

      expect((await screen.findByRole("tooltip")).textContent).toBe(USER_NAME);
    });

    it("keeps the same avatar on screen when collapsing and expanding, so the photo is not downloaded again", async () => {
      mocks.photo = { photoPath: PHOTO_PATH, reloadKey: 1 };
      const user = userEvent.setup();
      renderShell();
      const avatar = screen.getByRole("img", { name: `Foto de ${USER_NAME}` });

      await user.click(screen.getByRole("button", { name: COLLAPSE }));
      expect(screen.getByRole("img", { name: `Foto de ${USER_NAME}` })).toBe(avatar);

      await user.click(screen.getByRole("button", { name: EXPAND }));
      expect(screen.getByRole("img", { name: `Foto de ${USER_NAME}` })).toBe(avatar);
    });

    it("is not offered in the mobile drawer", async () => {
      renderShell();
      await openDrawer();

      expect(screen.queryByRole("button", { name: COLLAPSE })).toBeNull();
    });
  });

  describe("active navigation item", () => {
    it("marks the exact route as active", () => {
      signIn("ALUNO", "/meu-perfil");
      renderShell();

      expect(isSelected(navLink("Meu perfil"))).toBe(true);
    });

    it("keeps navigation items at their own height instead of stretching them to fill the menu", () => {
      signIn("ALUNO", "/meu-perfil");
      renderShell();

      expect(getComputedStyle(navLink("Meu perfil")).flexGrow).toBe("0");
    });

    it("marks a nested route as active for its section", () => {
      signIn("RECRUTADOR", "/recrutador/talentos/42");
      renderShell();

      expect(isSelected(navLink("Explorar talentos"))).toBe(true);
    });

    it("keeps the recruiter overview active only on its exact route", () => {
      signIn("RECRUTADOR", "/recrutador");
      renderShell();

      expect(isSelected(navLink("Visão geral"))).toBe(true);
      expect(isSelected(navLink("Explorar talentos"))).toBe(false);
    });

    it("does not mark the recruiter overview active on a nested route", () => {
      signIn("RECRUTADOR", "/recrutador/favoritos");
      renderShell();

      expect(isSelected(navLink("Visão geral"))).toBe(false);
      expect(isSelected(navLink("Favoritos"))).toBe(true);
    });

    it("does not mark the admin overview active on a nested route", () => {
      signIn("ADMIN", "/admin/alunos/7");
      renderShell();

      expect(isSelected(navLink("Visão geral"))).toBe(false);
      expect(isSelected(navLink("Alunos"))).toBe(true);
    });

    it("does not match a route that merely shares a prefix", () => {
      signIn("ADMIN", "/admin/alunos-antigos");
      renderShell();

      expect(isSelected(navLink("Alunos"))).toBe(false);
    });
  });

  describe("signed-out state", () => {
    it("hides account controls and the mobile menu button", () => {
      signIn(null);
      renderShell();

      expect(screen.queryByRole("button", { name: ACCOUNT_TRIGGER })).toBeNull();
      expect(screen.queryByRole("button", { name: "Abrir menu" })).toBeNull();
      expect(screen.queryByText(ROLE_LABEL.ALUNO)).toBeNull();
    });

    it("keeps the color mode toggle and the children available", () => {
      signIn(null);
      renderShell();

      expect(screen.getByRole("button", { name: SWITCH_TO_LIGHT })).not.toBeNull();
      expect(screen.getByText(PAGE_CONTENT)).not.toBeNull();
    });
  });

  describe("color mode toggle", () => {
    it("offers the light mode when the system prefers dark", () => {
      renderShell();

      expect(screen.getByRole("button", { name: SWITCH_TO_LIGHT })).not.toBeNull();
    });

    it("offers the dark mode when the system prefers light", () => {
      stubSystemColorScheme(false);
      renderShell();

      expect(screen.getByRole("button", { name: SWITCH_TO_DARK })).not.toBeNull();
    });

    it("switches to light and back to dark on consecutive clicks", async () => {
      const user = userEvent.setup();
      renderShell();

      await user.click(screen.getByRole("button", { name: SWITCH_TO_LIGHT }));
      await user.click(await screen.findByRole("button", { name: SWITCH_TO_DARK }));

      expect(await screen.findByRole("button", { name: SWITCH_TO_LIGHT })).not.toBeNull();
    });
  });

  describe("account avatar", () => {
    it("falls back to the user initials when there is no photo", () => {
      renderShell();

      expect(screen.getByText("AS")).not.toBeNull();
      expect(screen.queryByRole("img")).toBeNull();
    });

    it("requests the protected photo with its reload key and renders it", () => {
      mocks.photo = { photoPath: PHOTO_PATH, reloadKey: 3 };
      renderShell();

      expect(mocks.protectedFile).toHaveBeenCalledWith(PHOTO_PATH, 3);
      expect(screen.getByRole("img", { name: `Foto de ${USER_NAME}` }).getAttribute("src")).toBe(PHOTO_URL);
    });
  });

  describe("account menu", () => {
    it("starts closed and announces a popup menu on the trigger", () => {
      renderShell();

      const trigger = screen.getByRole("button", { name: ACCOUNT_TRIGGER });
      expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
      expect(trigger.getAttribute("aria-expanded")).toBeNull();
      expect(screen.queryByRole("menu")).toBeNull();
    });

    it("opens with change-password and logout entries", async () => {
      renderShell();
      const { menu } = await openAccountMenu();

      expect(within(menu).getByRole("menuitem", { name: "Alterar senha" })).not.toBeNull();
      expect(within(menu).getByRole("menuitem", { name: "Sair" })).not.toBeNull();
    });

    it("offers the privacy page only to recruiters, who have no profile page for it", async () => {
      signIn("RECRUTADOR");
      renderShell();
      const { menu } = await openAccountMenu();

      expect(within(menu).getByRole("menuitem", { name: "Privacidade" }).getAttribute("href")).toBe("/conta/privacidade");
    });

    it.each(["ALUNO", "ADMIN"] as const)("does not offer the privacy page to %s users", async (role) => {
      signIn(role);
      renderShell();
      const { menu } = await openAccountMenu();

      expect(within(menu).queryByRole("menuitem", { name: "Privacidade" })).toBeNull();
    });

    it("highlights the privacy entry only on the privacy page", async () => {
      signIn("RECRUTADOR", "/conta/privacidade");
      renderShell();
      const { menu } = await openAccountMenu();

      expect(isSelected(within(menu).getByRole("menuitem", { name: "Privacidade" }))).toBe(true);
      expect(isSelected(within(menu).getByRole("menuitem", { name: "Alterar senha" }))).toBe(false);
    });

    it("marks the trigger as expanded while the menu is open", async () => {
      renderShell();
      await openAccountMenu();

      const trigger = screen.getByRole("button", { name: ACCOUNT_TRIGGER, hidden: true });
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
    });

    it("links change-password to the account password page", async () => {
      renderShell();
      const { menu } = await openAccountMenu();

      expect(within(menu).getByRole("menuitem", { name: "Alterar senha" }).getAttribute("href")).toBe(CHANGE_PASSWORD);
    });

    it("highlights change-password only on the account password page", async () => {
      signIn("ALUNO", CHANGE_PASSWORD);
      renderShell();
      const { menu } = await openAccountMenu();

      expect(isSelected(within(menu).getByRole("menuitem", { name: "Alterar senha" }))).toBe(true);
    });

    it("does not highlight change-password on other pages", async () => {
      renderShell();
      const { menu } = await openAccountMenu();

      expect(isSelected(within(menu).getByRole("menuitem", { name: "Alterar senha" }))).toBe(false);
    });

    it("closes when the Escape key is pressed", async () => {
      renderShell();
      const { user } = await openAccountMenu();

      await user.keyboard("{Escape}");

      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });

    it("closes after choosing change-password", async () => {
      renderShell();
      const { user, menu } = await openAccountMenu();

      await user.click(within(menu).getByRole("menuitem", { name: "Alterar senha" }));

      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });
  });

  describe("demonstration session", () => {
    function signInAsDemo(role: "ALUNO" | "RECRUTADOR") {
      signIn(role);
      mocks.auth.user = { ...mocks.auth.user!, modoDemonstracao: true };
    }

    it("shows the fixed demonstration notice with the way back to the administrator", () => {
      signInAsDemo("RECRUTADOR");
      renderShell();

      expect(screen.getByRole("region", { name: "Modo demonstração" }).textContent).toContain("vendo como Recrutador");
      expect(screen.getByRole("button", { name: "Voltar ao Admin" })).not.toBeNull();
    });

    it("does not show the notice to a regular session", () => {
      renderShell();

      expect(screen.queryByRole("region", { name: "Modo demonstração" })).toBeNull();
    });

    it("hides change-password from the account menu but keeps logout", async () => {
      signInAsDemo("ALUNO");
      renderShell();
      const { menu } = await openAccountMenu();

      expect(within(menu).queryByRole("menuitem", { name: "Alterar senha" })).toBeNull();
      expect(within(menu).getByRole("menuitem", { name: "Sair" })).not.toBeNull();
    });
  });

  describe("logout from the account menu", () => {
    it("logs out, closes the menu and redirects to the login page", async () => {
      renderShell();
      const { user, menu } = await openAccountMenu();

      await user.click(within(menu).getByRole("menuitem", { name: "Sair" }));

      await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith(LOGIN));
      expect(mocks.auth.logout).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });

    it("redirects only after the logout has finished", async () => {
      let finishLogout: () => void = () => undefined;
      mocks.auth.logout = vi.fn().mockReturnValue(
        new Promise<void>((resolve) => {
          finishLogout = resolve;
        }),
      );
      renderShell();
      const { user, menu } = await openAccountMenu();

      await user.click(within(menu).getByRole("menuitem", { name: "Sair" }));
      expect(mocks.router.replace).not.toHaveBeenCalled();

      finishLogout();
      await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith(LOGIN));
    });
  });

  describe("mobile drawer", () => {
    it("starts closed", () => {
      renderShell();

      expect(screen.queryByRole("button", { name: "Fechar menu" })).toBeNull();
    });

    it("shows the user name, role, avatar initials and the navigation links when opened", async () => {
      signIn("RECRUTADOR");
      renderShell();
      await openDrawer();

      expect(drawer().getByText(USER_NAME)).not.toBeNull();
      expect(drawer().getByText(ROLE_LABEL.RECRUTADOR)).not.toBeNull();
      expect(drawer().getByText("AS")).not.toBeNull();
      for (const label of NAV_LABELS.RECRUTADOR) {
        expect(drawer().getByRole("link", { name: label })).not.toBeNull();
      }
    });

    it("renders the protected photo in the drawer header", async () => {
      mocks.photo = { photoPath: PHOTO_PATH, reloadKey: 1 };
      renderShell();
      await openDrawer();

      expect(screen.getByRole("img", { name: `Foto de ${USER_NAME}` }).getAttribute("src")).toBe(PHOTO_URL);
    });

    it("highlights the active item for the current route", async () => {
      signIn("ADMIN", "/admin/auditoria");
      renderShell();
      await openDrawer();

      expect(isSelected(navLink("Auditoria"))).toBe(true);
      expect(isSelected(navLink("Visão geral"))).toBe(false);
    });

    it("marks the current page link for assistive technology", async () => {
      signIn("ADMIN", "/admin/auditoria");
      renderShell();
      await openDrawer();

      expect(navLink("Auditoria").getAttribute("aria-current")).toBe("page");
      expect(navLink("Visão geral").getAttribute("aria-current")).toBeNull();
    });

    it("offers the account menu with change-password and highlights it on the account password page", async () => {
      signIn("ALUNO", CHANGE_PASSWORD);
      renderShell();
      const user = await openDrawer();

      await user.click(screen.getByRole("button", { name: ACCOUNT_TRIGGER }));
      const item = within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Alterar senha" });

      expect(item.getAttribute("href")).toBe(CHANGE_PASSWORD);
      expect(isSelected(item)).toBe(true);
    });

    it("closes by itself when the address changes, for instance with the phone's back gesture", async () => {
      signIn("RECRUTADOR", "/recrutador");
      const { rerender } = renderShell();
      await openDrawer();

      mocks.pathname = "/recrutador/favoritos";
      rerender(shellTree());

      await waitForDrawerToClose();
    });

    it("also closes the account menu when the address changes", async () => {
      const { rerender } = renderShell();
      await openAccountMenu();

      mocks.pathname = "/meu-perfil/outra";
      rerender(shellTree());

      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });

    it("does not open on a screen as wide as a desktop", async () => {
      stubResizableScreen(true);
      const user = userEvent.setup();
      renderShell();

      await user.click(screen.getByRole("button", { name: "Abrir menu", hidden: true }));

      expect(screen.queryByRole("button", { name: "Fechar menu" })).toBeNull();
    });

    it("closes, instead of staying open and locking the page, when the screen becomes as wide as a desktop", async () => {
      const screenSize = stubResizableScreen(false);
      renderShell();
      await openDrawer();

      screenSize.setDesktop(true);

      await waitForDrawerToClose();
    });

    it("also closes an account menu opened from the drawer when the screen becomes as wide as a desktop", async () => {
      const screenSize = stubResizableScreen(false);
      renderShell();
      const user = await openDrawer();
      await user.click(screen.getByRole("button", { name: ACCOUNT_TRIGGER }));
      await screen.findByRole("menu");

      screenSize.setDesktop(true);

      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    });

    it("closes with the close button", async () => {
      renderShell();
      const user = await openDrawer();

      await user.click(screen.getByRole("button", { name: "Fechar menu" }));

      await waitForDrawerToClose();
    });

    it("closes when the Escape key is pressed", async () => {
      renderShell();
      const user = await openDrawer();

      await user.keyboard("{Escape}");

      await waitForDrawerToClose();
    });

    it("closes after choosing a navigation link", async () => {
      signIn("RECRUTADOR");
      renderShell();
      const user = await openDrawer();

      await user.click(navLink("Favoritos"));

      await waitForDrawerToClose();
    });

    it("closes after choosing change-password in the account menu", async () => {
      renderShell();
      const user = await openDrawer();

      await user.click(screen.getByRole("button", { name: ACCOUNT_TRIGGER }));
      await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: "Alterar senha" }));

      await waitForDrawerToClose();
    });

    it("closes after clicking the brand, which leads to the landing page", async () => {
      signIn("ADMIN", "/admin/alunos");
      renderShell();
      const user = await openDrawer();
      const brand = screen.getByRole("link", { name: BRAND_NAME });

      expect(brand.getAttribute("href")).toBe(LANDING);
      await user.click(brand);

      await waitForDrawerToClose();
    });

    it("logs out from the account menu, closes the drawer and redirects to the login page", async () => {
      renderShell();
      const user = await openDrawer();

      await user.click(screen.getByRole("button", { name: ACCOUNT_TRIGGER }));
      await user.click(await screen.findByRole("menuitem", { name: "Sair" }));

      await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith(LOGIN));
      expect(mocks.auth.logout).toHaveBeenCalledTimes(1);
      await waitForDrawerToClose();
    });
  });
});
