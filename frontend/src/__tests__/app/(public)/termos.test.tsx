import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TermosPage, { metadata } from "@/app/(public)/termos/page";

const SECTION_TITLES = [
  "1. Identidade e Contato",
  "2. Aceitação e Cadastro",
  "3. Uso da Plataforma",
  "4. Dados Pessoais",
  "5. Suspensão e Exclusão",
  "6. Alterações e Contato",
];

describe("terms of use page", () => {
  it("titles the page for the browser tab", () => {
    expect(metadata.title).toBe("Termos de Uso | Talent Valley");
  });

  it("renders the terms with their title, dates and six sections", () => {
    render(<TermosPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Termos de Uso" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(SECTION_TITLES);
    expect(screen.getByText(/a partir da publicação \(implantação\)/)).toBeTruthy();
    expect(screen.getByText("Última atualização: data da implantação")).toBeTruthy();
  });

  it("refers to the privacy policy for personal data handling", () => {
    render(<TermosPage />);

    expect(screen.getByText(/O tratamento de dados pessoais segue a Política de Privacidade/)).toBeTruthy();
  });
});
