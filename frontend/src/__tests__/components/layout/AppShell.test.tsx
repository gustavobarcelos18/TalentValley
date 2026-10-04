import type { ComponentProps } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
const ROLE_HOME: Record<UserRole, string> = { ALUNO: "/meu-perfil", RECRUTADOR: "/recrutador", ADMIN: "/admin" };
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

function renderShell() {
  return render(
    <ThemeProvider theme={talentValleyTheme}>
      <AppShell>
        <p>{PAGE_CONTENT}</p>
      </AppShell>
    </ThemeProvider>,
  );
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
    it.each(ROLES)("leads %s users to their own home", (role) => {
      signIn(role, "/qualquer/rota");
      renderShell();

      expect(navLink("Talent Valley").getAttribute("href")).toBe(ROLE_HOME[role]);
    });

    it("is plain, non-interactive identity while there is no signed-in user", () => {
      signIn(null);
      renderShell();

      expect(screen.getByText("Valley")).not.toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  describe("active navigation item", () => {
    it("marks the exact route as active", () => {
      signIn("ALUNO", "/meu-perfil");
      renderShell();

      expect(isSelected(navLink("Meu perfil"))).toBe(true);
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

    it("links change-password and highlights it on the account password page", async () => {
      signIn("ALUNO", CHANGE_PASSWORD);
      renderShell();
      await openDrawer();

      const link = navLink("Alterar senha");
      expect(link.getAttribute("href")).toBe(CHANGE_PASSWORD);
      expect(isSelected(link)).toBe(true);
    });

    it("does not highlight change-password on other pages", async () => {
      renderShell();
      await openDrawer();

      expect(isSelected(navLink("Alterar senha"))).toBe(false);
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

    it("closes after choosing change-password", async () => {
      renderShell();
      const user = await openDrawer();

      await user.click(navLink("Alterar senha"));

      await waitForDrawerToClose();
    });

    it("closes after clicking the brand, which leads to the role home", async () => {
      signIn("ADMIN", "/admin/alunos");
      renderShell();
      const user = await openDrawer();
      const brand = navLink("Talent Valley");

      expect(brand.getAttribute("href")).toBe(ROLE_HOME.ADMIN);
      await user.click(brand);

      await waitForDrawerToClose();
    });

    it("logs out, closes the drawer and redirects to the login page", async () => {
      renderShell();
      const user = await openDrawer();

      await user.click(screen.getByRole("button", { name: "Sair" }));

      await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith(LOGIN));
      expect(mocks.auth.logout).toHaveBeenCalledTimes(1);
      await waitForDrawerToClose();
    });
  });
});
