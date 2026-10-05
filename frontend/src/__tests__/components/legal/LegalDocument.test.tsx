import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LegalDocument } from "@/components/legal/LegalDocument";

const SECTIONS = [
  { title: "1. First", paragraphs: ["First paragraph.", "Second paragraph."] },
  { title: "2. Second", paragraphs: ["Only paragraph."] },
];

function renderDocument() {
  render(<LegalDocument title="Test Terms" effective="today" sections={SECTIONS} lastUpdated="yesterday" />);
}

describe("LegalDocument", () => {
  it("renders the title, effective date and last update", () => {
    renderDocument();

    expect(screen.getByRole("heading", { level: 1, name: "Test Terms" })).toBeTruthy();
    expect(screen.getByText("Efetiva a partir de:").parentElement?.textContent).toBe("Efetiva a partir de: today");
    expect(screen.getByText("Última atualização: yesterday")).toBeTruthy();
  });

  it("renders each section with its heading and paragraphs, in order", () => {
    renderDocument();

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((heading) => heading.textContent)).toEqual(["1. First", "2. Second"]);
    const [first, second] = headings.map((heading) => heading.parentElement as HTMLElement);
    expect(within(first).getByText("First paragraph.")).toBeTruthy();
    expect(within(first).getByText("Second paragraph.")).toBeTruthy();
    expect(within(second).getByText("Only paragraph.")).toBeTruthy();
    expect(within(second).queryByText("First paragraph.")).toBeNull();
  });

  it("links back to the home page", () => {
    renderDocument();

    expect(screen.getByRole("link", { name: "Página inicial" }).getAttribute("href")).toBe("/");
  });
});
