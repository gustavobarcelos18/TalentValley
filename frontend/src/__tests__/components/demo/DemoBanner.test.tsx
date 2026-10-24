import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { DEMO_BANNER_HEIGHT_VAR } from "@/components/demo/bannerHeight";
import { leaveDemo } from "@/lib/auth";
import type { UsuarioAutenticado } from "@/types/auth";
import { renderThemed as render } from "../recruiter/renderThemed";
import { userWith } from "../auth/authMock";

const mocks = vi.hoisted(() => ({ auth: { user: null as UsuarioAutenticado | null } }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/auth", () => ({ leaveDemo: vi.fn() }));

const leaveDemoMock = vi.mocked(leaveDemo);
const assignMock = vi.fn();
const LEAVE = "Voltar ao Admin";

function demoUser(role: "ALUNO" | "RECRUTADOR"): UsuarioAutenticado {
  return { ...userWith(role), modoDemonstracao: true };
}

describe("DemoBanner", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("location", { ...window.location, assign: assignMock });
    mocks.auth.user = demoUser("ALUNO");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["ALUNO", "Aluno"],
    ["RECRUTADOR", "Recrutador"],
  ] as const)("tells a %s demonstration session that the data is fictitious", (role, label) => {
    mocks.auth.user = demoUser(role);
    render(<DemoBanner />);

    expect(screen.getByRole("region", { name: "Modo demonstração" }).textContent).toContain(
      `Modo demonstração: você está vendo como ${label}. Dados fictícios.`,
    );
    expect(screen.getByRole("button", { name: LEAVE })).toBeTruthy();
  });

  it.each([null, userWith("ADMIN"), userWith("ALUNO")])("renders nothing outside a demonstration session (%#)", (user) => {
    mocks.auth.user = user;
    render(<DemoBanner />);

    expect(screen.queryByRole("region", { name: "Modo demonstração" })).toBeNull();
  });

  it("publishes its height for the fixed bars below it and withdraws it when it goes away", () => {
    const { unmount } = render(<DemoBanner />);

    expect(document.documentElement.style.getPropertyValue(DEMO_BANNER_HEIGHT_VAR)).toBe("0px");

    unmount();

    expect(document.documentElement.style.getPropertyValue(DEMO_BANNER_HEIGHT_VAR)).toBe("");
  });

  it("returns to the administrator by loading its start page from scratch", async () => {
    leaveDemoMock.mockResolvedValue({ usuario: userWith("ADMIN"), destinoInicial: "/admin" });
    const user = userEvent.setup();
    render(<DemoBanner />);

    await user.click(screen.getByRole("button", { name: LEAVE }));

    await waitFor(() => expect(assignMock).toHaveBeenCalledWith("/admin"));
  });

  it("disables the button while returning, so it cannot be sent twice", async () => {
    leaveDemoMock.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<DemoBanner />);

    await user.click(screen.getByRole("button", { name: LEAVE }));

    const busy = await screen.findByRole("button", { name: "Voltando..." });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(leaveDemoMock).toHaveBeenCalledTimes(1);
  });

  it("shows a message and allows trying again when returning fails", async () => {
    leaveDemoMock.mockRejectedValue(new Error("Account access is unavailable."));
    const user = userEvent.setup();
    render(<DemoBanner />);

    await user.click(screen.getByRole("button", { name: LEAVE }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Não foi possível voltar ao Admin.");
    expect(alert.textContent).not.toContain("Account access");
    expect((screen.getByRole("button", { name: LEAVE }) as HTMLButtonElement).disabled).toBe(false);
    expect(assignMock).not.toHaveBeenCalled();
  });
});
