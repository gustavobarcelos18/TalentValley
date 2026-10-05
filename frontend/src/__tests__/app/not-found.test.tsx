import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import NotFound from "@/app/not-found";

vi.mock("@/components/auth/AuthLayout", () => ({ AuthShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/auth/SystemScene", () => ({ SystemScene: () => null }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));

describe("not found page", () => {
  it("explains the page is missing and links back to the home page", () => {
    render(<NotFound />);

    expect(screen.getByText("ERRO 404")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Página não encontrada" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("O endereço que você tentou abrir não existe ou foi movido.");
    expect(screen.getByRole("link", { name: "Ir para o início" }).getAttribute("href")).toBe("/");
  });
});
