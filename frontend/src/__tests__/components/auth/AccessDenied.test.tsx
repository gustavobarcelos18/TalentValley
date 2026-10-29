import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMotionMedia } from "./motion/motionMedia";
import { AccessDenied } from "@/components/auth/AccessDenied";
import type { UserRole } from "@/types/auth";

const HOME: Record<UserRole, string> = { ALUNO: "/inicio", RECRUTADOR: "/recrutador", ADMIN: "/admin" };

describe("AccessDenied", () => {
  beforeEach(() => stubMotionMedia("reduced"));
  afterEach(() => vi.unstubAllGlobals());

  it("explains the denial with the page title and a warning message", () => {
    render(<AccessDenied role="ALUNO" />);

    expect(screen.getByRole("heading", { level: 1, name: "Acesso negado" })).not.toBeNull();
    expect(screen.getByText("Seu perfil não tem permissão para acessar esta página.")).not.toBeNull();
  });

  it.each(Object.keys(HOME) as UserRole[])("sends %s users back to their own area", (role) => {
    render(<AccessDenied role={role} />);

    expect(screen.getByRole("link", { name: "Ir para minha área" }).getAttribute("href")).toBe(HOME[role]);
  });

  it("does not add a main landmark of its own, since the app shell already provides one", () => {
    render(<AccessDenied role="ADMIN" />);

    expect(screen.queryByRole("main")).toBeNull();
  });
});
