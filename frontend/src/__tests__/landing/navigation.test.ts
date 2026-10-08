import { describe, expect, it } from "vitest";
import { navigation } from "@/components/landing/navigation";

describe("navigation", () => {
  it("lists the landing sections in page order", () => {
    expect(navigation.map(([id]) => id)).toEqual(["hero", "talentos", "recrutadores", "como-funciona", "rio-pomba-valley"]);
  });

  it("gives every section a label", () => {
    for (const [, label] of navigation) expect(label.length).toBeGreaterThan(0);
  });
});
