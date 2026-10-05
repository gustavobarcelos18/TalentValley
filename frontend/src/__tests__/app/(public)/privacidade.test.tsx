import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PrivacidadePage, { metadata } from "@/app/(public)/privacidade/page";

const SECTION_TITLES = [
  "1. Identidade e Contato",
  "2. Dados Coletados",
  "3. Finalidades",
  "4. Retenção",
  "5. Direitos do Titular",
  "6. Contato",
];

describe("privacy policy page", () => {
  it("titles the page for the browser tab", () => {
    expect(metadata.title).toBe("Política de Privacidade | Talent Valley");
  });

  it("renders the policy with its title, dates and six sections", () => {
    render(<PrivacidadePage />);

    expect(screen.getByRole("heading", { level: 1, name: "Política de Privacidade" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(SECTION_TITLES);
    expect(screen.getByText(/a partir da publicação \(implantação\)/)).toBeTruthy();
    expect(screen.getByText("Última atualização: data da implantação")).toBeTruthy();
  });

  it("covers the data subject rights under the LGPD", () => {
    render(<PrivacidadePage />);

    expect(screen.getByText(/Lei Geral de Proteção de Dados \(Lei nº 13\.709\/2018\)/)).toBeTruthy();
  });
});
