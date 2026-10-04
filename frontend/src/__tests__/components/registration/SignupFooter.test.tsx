import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignupFooter } from "@/components/registration/SignupFooter";

const BACK_LABEL = "Voltar para o início";

function loginParagraph() {
  return screen.getByRole("link", { name: "Entrar na plataforma" }).parentElement as HTMLElement;
}

describe("SignupFooter", () => {
  it("links to the login and to the given way back", () => {
    render(<SignupFooter backHref="/" backLabel={BACK_LABEL} />);

    expect(screen.getByRole("link", { name: "Entrar na plataforma" }).getAttribute("href")).toBe("/login");
    expect(screen.getByRole("link", { name: BACK_LABEL }).getAttribute("href")).toBe("/");
    expect(loginParagraph().textContent).toContain("Já possui acesso?");
  });

  it("stacks by default, with the login text above the back link", () => {
    render(<SignupFooter backHref="/" backLabel={BACK_LABEL} />);

    const login = loginParagraph();
    expect(getComputedStyle(login).marginTop).toBe("24px");
    expect(login.compareDocumentPosition(screen.getByRole("link", { name: BACK_LABEL })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("puts both on one row when inline", () => {
    render(<SignupFooter backHref="/cadastro" backLabel="Voltar" inline />);

    const login = loginParagraph();
    expect(getComputedStyle(login).marginTop).not.toBe("24px");
    const row = login.parentElement as HTMLElement;
    expect(getComputedStyle(row).display).toBe("flex");
    expect(row.contains(screen.getByRole("link", { name: "Voltar" }))).toBe(true);
    expect(screen.getByRole("link", { name: "Voltar" }).getAttribute("href")).toBe("/cadastro");
  });
});
