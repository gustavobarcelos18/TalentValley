import { describe, expect, it } from "vitest";
import { COMPARISON_PATH, COMPARISON_TABLE_PATH, comparisonHref, comparisonSlugs } from "@/lib/comparison";

function params(...slugs: string[]) {
  const search = new URLSearchParams();
  for (const slug of slugs) search.append("slugs", slug);
  return search;
}

describe("comparisonSlugs", () => {
  it("accepts exactly two different slugs, keeping their order", () => {
    expect(comparisonSlugs(params("ana", "bruno"))).toEqual(["ana", "bruno"]);
    expect(comparisonSlugs(params("bruno", "ana"))).toEqual(["bruno", "ana"]);
  });

  it.each([
    { description: "none", slugs: [] as string[] },
    { description: "one", slugs: ["ana"] },
    { description: "three", slugs: ["ana", "bruno", "carla"] },
    { description: "identical", slugs: ["ana", "ana"] },
    { description: "a blank first", slugs: [" ", "bruno"] },
    { description: "a blank second", slugs: ["ana", ""] },
  ])("rejects $description slugs", ({ slugs }) => {
    expect(comparisonSlugs(params(...slugs))).toBeNull();
  });
});

describe("comparisonHref", () => {
  it("builds the same query for both views", () => {
    expect(comparisonHref(COMPARISON_PATH, ["ana", "bruno"])).toBe("/recrutador/comparar?slugs=ana&slugs=bruno");
    expect(comparisonHref(COMPARISON_TABLE_PATH, ["ana", "bruno"])).toBe("/recrutador/comparar/tabela?slugs=ana&slugs=bruno");
  });

  it("encodes slugs and round-trips through the parser", () => {
    const href = comparisonHref(COMPARISON_TABLE_PATH, ["ana lima", "b&c"]);

    expect(href).toBe("/recrutador/comparar/tabela?slugs=ana%20lima&slugs=b%26c");
    expect(comparisonSlugs(new URL(href, "http://localhost").searchParams)).toEqual(["ana lima", "b&c"]);
  });
});
