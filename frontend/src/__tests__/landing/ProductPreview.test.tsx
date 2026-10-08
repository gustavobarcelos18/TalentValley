import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductPreview } from "@/components/landing/ProductPreview";

const TALENT_LABEL = "Ilustração: exemplo de perfil de talento";
const SEARCH_LABEL = "Ilustração: exemplo de busca de talentos com filtros e resultados";
const MARINA = "Marina Couto";
const VERIFIED = "RPV verificado";
const COMPANY_VERIFIED = "Formação RPV verificada";
const RESULT_NAMES = [MARINA, "Rafael Teixeira", "Beatriz Lacerda"];
const HIDDEN_CARD = "[aria-hidden='true']";

function chipLabels(root: HTMLElement) {
  return [...root.querySelectorAll(".preview-chip")].map((chip) => chip.textContent);
}

describe("ProductPreview", () => {
  describe("talent audience", () => {
    it("is a single labelled image, not the search illustration", () => {
      render(<ProductPreview audience="talent" />);
      expect(screen.getByRole("img", { name: TALENT_LABEL })).toBeTruthy();
      expect(screen.queryByRole("img", { name: SEARCH_LABEL })).toBeNull();
    });

    it("hides its whole content from assistive tech", () => {
      render(<ProductPreview audience="talent" />);
      const card = screen.getByRole("img", { name: TALENT_LABEL }).querySelector(HIDDEN_CARD);
      expect(card).not.toBeNull();
      expect(card?.contains(screen.getByText(MARINA))).toBe(true);
      expect(card?.contains(screen.getByText(VERIFIED))).toBe(true);
    });

    it("shows the fictional profile with initials, formation, skills and availability", () => {
      const { container } = render(<ProductPreview audience="talent" />);
      expect(screen.getByRole("heading", { level: 3, name: MARINA, hidden: true })).toBeTruthy();
      expect(screen.getByText("MC")).toBeTruthy();
      expect(screen.getByText("Rio Pomba, MG")).toBeTruthy();
      expect(screen.getByText("Concluído")).toBeTruthy();
      expect(screen.getByText(/Tecnólogo em Análise e Desenvolvimento de Sistemas/)).toBeTruthy();
      expect(chipLabels(container)).toEqual(["React", "TypeScript", "Node.js", "SQL", "Figma", "Estágio", "CLT", "Híbrido", "Remoto"]);
    });
  });

  describe("company audience", () => {
    it("is a single labelled image, not the profile illustration", () => {
      render(<ProductPreview audience="company" />);
      expect(screen.getByRole("img", { name: SEARCH_LABEL })).toBeTruthy();
      expect(screen.queryByRole("img", { name: TALENT_LABEL })).toBeNull();
    });

    it("hides its whole content from assistive tech", () => {
      render(<ProductPreview audience="company" />);
      const card = screen.getByRole("img", { name: SEARCH_LABEL }).querySelector(HIDDEN_CARD);
      expect(card).not.toBeNull();
      expect(card?.contains(screen.getByText("3 talentos encontrados"))).toBe(true);
      expect(card?.contains(screen.getByText(COMPANY_VERIFIED))).toBe(true);
    });

    it("shows the search with its filters and the three fictional results", () => {
      const { container } = render(<ProductPreview audience="company" />);
      expect(container.querySelector(".preview-search")?.textContent).toBe("React");
      expect(screen.getByText(COMPANY_VERIFIED)).toBeTruthy();
      expect(screen.getAllByRole("heading", { level: 3, hidden: true }).map((heading) => heading.textContent)).toEqual(RESULT_NAMES);
      expect([...container.querySelectorAll(".preview-avatar")].map((avatar) => avatar.textContent)).toEqual(["MC", "RT", "BL"]);
      expect(screen.getByText("Rio Pomba, MG · Técnico em Informática")).toBeTruthy();
      expect(chipLabels(container)).toEqual([
        "Competência: React", "Cidade: Rio Pomba",
        "React", "TypeScript", "SQL",
        "React", "Node.js", "Git",
        "React", "JavaScript", "UX",
      ]);
    });

    it("marks only the first two results as selected", () => {
      const { container } = render(<ProductPreview audience="company" />);
      const rows = [...container.querySelectorAll(".preview-results li")];
      expect(rows).toHaveLength(RESULT_NAMES.length);
      expect(rows.map((row) => row.querySelector(".preview-check")?.classList.contains("is-checked"))).toEqual([true, true, false]);
      expect(rows.map((row) => row.querySelector("[data-testid]")?.getAttribute("data-testid"))).toEqual([
        "CheckBoxIcon", "CheckBoxIcon", "CheckBoxOutlineBlankIcon",
      ]);
    });
  });
});
