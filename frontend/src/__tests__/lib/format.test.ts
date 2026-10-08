import { describe, expect, it } from "vitest";
import { formatDate, formatDateInput, formatUpdatedAt, initialsOf, parseDateInput } from "@/lib/format";

const ISO_DATE = "2026-03-05";
const BR_DATE = "05/03/2026";

describe("initialsOf", () => {
  it.each([
    ["  ", "?"],
    ["ana", "A"],
    ["ana maria souza", "AS"],
    ["  joão   silva ", "JS"],
  ])("%j -> %s", (name, initials) => {
    expect(initialsOf(name)).toBe(initials);
  });
});

describe("date formatting", () => {
  it("formatDate keeps date-only values on the same day", () => {
    expect(formatDate("2026-03-01")).toBe("01/03/2026");
    expect(formatDate("2026-12-31T23:59:59Z")).toBe("31/12/2026");
  });

  it("formatUpdatedAt renders day, month, year and time in pt-BR", () => {
    expect(formatUpdatedAt("2026-03-05T14:07:00")).toMatch(/^05\/03\/2026,? 14:07$/);
  });

  it("formatDateInput converts ISO to dd/mm/yyyy and tolerates missing values", () => {
    expect(formatDateInput(ISO_DATE)).toBe(BR_DATE);
    expect(formatDateInput("2026-03-05T10:00:00Z")).toBe(BR_DATE);
    expect(formatDateInput(null)).toBe("");
    expect(formatDateInput(BR_DATE)).toBe("");
  });

  it("parseDateInput converts dd/mm/yyyy to ISO and rejects invalid dates", () => {
    expect(parseDateInput(` ${BR_DATE} `)).toBe(ISO_DATE);
    expect(parseDateInput("29/02/2024")).toBe("2024-02-29");
    expect(parseDateInput("29/02/2026")).toBeNull();
    expect(parseDateInput("31/04/2026")).toBeNull();
    expect(parseDateInput(ISO_DATE)).toBeNull();
    expect(parseDateInput("")).toBeNull();
  });
});
