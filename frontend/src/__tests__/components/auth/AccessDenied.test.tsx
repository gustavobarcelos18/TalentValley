import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccessDenied } from "@/components/auth/AccessDenied";
import type { UserRole } from "@/types/auth";

vi.mock("@/components/auth/AuthLayout", () => ({
  AuthShell: ({ children }: { children: ReactNode }) => <div data-testid="shell">{children}</div>,
}));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));

describe("AccessDenied", () => {
  it("explains the 403 inside the auth shell", () => {
    render(<AccessDenied role="ALUNO" />);

    const shell = screen.getByTestId("shell");
    expect(shell.contains(screen.getByRole("heading", { level: 1, name: "Acesso negado" }))).toBe(true);
    expect(shell.textContent).toContain("ERRO 403");
    expect(screen.getByRole("alert").textContent).toBe("Seu perfil não tem permissão para acessar esta página.");
    expect(screen.getByRole("alert").className).toContain("MuiAlert-colorWarning");
  });

  it.each<[UserRole, string]>([
    ["ALUNO", "/meu-perfil"],
    ["RECRUTADOR", "/recrutador"],
    ["ADMIN", "/admin"],
  ])("sends a %s back to their own area", (role, href) => {
    render(<AccessDenied role={role} />);

    expect(screen.getByRole("link", { name: "Ir para minha área" }).getAttribute("href")).toBe(href);
  });
});
