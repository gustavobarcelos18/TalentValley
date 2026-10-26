import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComparisonViewTabs } from "@/components/recruiter/ComparisonViewTabs";
import { renderThemed as render } from "./renderThemed";

const SLUGS = ["ana-lima", "bruno-reis"] as const;
const CURRENT_HREF = "/recrutador/comparar?slugs=ana-lima&slugs=bruno-reis";
const TABLE_HREF = "/recrutador/comparar/tabela?slugs=ana-lima&slugs=bruno-reis";

describe("ComparisonViewTabs", () => {
  it("offers both views as links inside a labelled navigation", () => {
    render(<ComparisonViewTabs slugs={SLUGS} active="atual" />);

    expect(screen.getByRole("navigation", { name: "Visualização da comparação" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Comparação atual" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Tabela de currículos" })).toBeTruthy();
  });

  it("keeps the two selected talents in both links, so nobody has to select them again", () => {
    render(<ComparisonViewTabs slugs={SLUGS} active="atual" />);

    expect(screen.getByRole("tab", { name: "Comparação atual" }).getAttribute("href")).toBe(CURRENT_HREF);
    expect(screen.getByRole("tab", { name: "Tabela de currículos" }).getAttribute("href")).toBe(TABLE_HREF);
  });

  it("marks only the current view as the current page", () => {
    const { unmount } = render(<ComparisonViewTabs slugs={SLUGS} active="atual" />);
    expect(screen.getByRole("tab", { name: "Comparação atual" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("tab", { name: "Tabela de currículos" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("tab", { name: "Comparação atual" }).getAttribute("aria-selected")).toBe("true");
    unmount();

    render(<ComparisonViewTabs slugs={SLUGS} active="tabela" />);
    expect(screen.getByRole("tab", { name: "Tabela de currículos" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("tab", { name: "Comparação atual" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("tab", { name: "Tabela de currículos" }).getAttribute("aria-selected")).toBe("true");
  });
});
