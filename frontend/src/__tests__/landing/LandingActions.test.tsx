import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FooterAccessLink, HeroActions, JoinActions } from "@/components/landing/LandingActions";
import type { UserRole } from "@/types/auth";

const auth = vi.hoisted(() => ({ user: null as { role: UserRole } | null }));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock("@/components/landing/motion/ActionMotion", () => ({ ActionMotion: ({ children }: { children: ReactNode }) => <>{children}</> }));

const TALENT = "Sou Talento";
const RECRUITER = "Sou Recrutador";
const AREA = "Acessar minha área";
const TALENT_SIGNUP = "/cadastro/aluno";
const RECRUITER_SIGNUP = "/cadastro/recrutador";

function link(name: string) {
  return screen.getByRole("link", { name });
}

function hrefOf(name: string) {
  return link(name).getAttribute("href");
}

describe("landing actions", () => {
  beforeEach(() => {
    auth.user = null;
  });

  describe("JoinActions", () => {
    it("offers both sign-up paths to visitors, the recruiter one as secondary", () => {
      render(<JoinActions />);
      expect(hrefOf(TALENT)).toBe(TALENT_SIGNUP);
      expect(hrefOf(RECRUITER)).toBe(RECRUITER_SIGNUP);
      expect(link(TALENT).className).toContain("MuiButton-contained");
      expect(link(RECRUITER).className).toContain("MuiButton-outlined");
    });

    it("shows only the talent path for the talent audience", () => {
      render(<JoinActions audience="talent" />);
      expect(hrefOf(TALENT)).toBe(TALENT_SIGNUP);
      expect(screen.queryByRole("link", { name: RECRUITER })).toBeNull();
    });

    it("shows only the recruiter path, as primary, for the company audience", () => {
      render(<JoinActions audience="company" />);
      expect(hrefOf(RECRUITER)).toBe(RECRUITER_SIGNUP);
      expect(link(RECRUITER).className).toContain("MuiButton-contained");
      expect(screen.queryByRole("link", { name: TALENT })).toBeNull();
    });

    it("sends a signed-in user to their own area", () => {
      auth.user = { role: "RECRUTADOR" };
      render(<JoinActions />);
      expect(hrefOf(AREA)).toBe("/recrutador");
      expect(screen.queryByRole("link", { name: TALENT })).toBeNull();
    });
  });

  describe("HeroActions", () => {
    it("offers both sign-up paths to visitors, the recruiter one as secondary", () => {
      render(<HeroActions />);
      expect(hrefOf(TALENT)).toBe(TALENT_SIGNUP);
      expect(hrefOf(RECRUITER)).toBe(RECRUITER_SIGNUP);
      expect(link(TALENT).className).toContain("MuiButton-contained");
      expect(link(RECRUITER).className).toContain("MuiButton-outlined");
    });

    it("sends a signed-in user to their own area", () => {
      auth.user = { role: "ALUNO" };
      render(<HeroActions />);
      expect(hrefOf(AREA)).toBe("/meu-perfil");
      expect(screen.getAllByRole("link")).toHaveLength(1);
    });
  });

  describe("FooterAccessLink", () => {
    it("links visitors to the login", () => {
      render(<FooterAccessLink />);
      expect(hrefOf("Entrar")).toBe("/login");
    });

    it("links a signed-in user to their own area", () => {
      auth.user = { role: "ADMIN" };
      render(<FooterAccessLink />);
      expect(hrefOf("Minha área")).toBe("/admin");
    });
  });
});
