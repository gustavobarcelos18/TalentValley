import { describe, expect, it } from "vitest";
import { AppPaths, getRoleDestination } from "@/lib/paths";
import type { UserRole } from "@/types/auth";

describe("getRoleDestination", () => {
  it.each([
    ["ALUNO", "/meu-perfil"],
    ["RECRUTADOR", "/recrutador"],
    ["ADMIN", "/admin"],
    ["DESCONHECIDO", "/login"],
  ])("%s -> %s", (role, destination) => {
    expect(getRoleDestination(role as UserRole)).toBe(destination);
  });
});

describe("AppPaths", () => {
  it("keeps the protected and guest-only areas apart", () => {
    const overlap = AppPaths.protected.filter((path) => (AppPaths.guestOnly as readonly string[]).includes(path));

    expect(overlap).toEqual([]);
  });
});
