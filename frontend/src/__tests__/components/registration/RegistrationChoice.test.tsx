import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMotionMedia } from "@/__tests__/components/auth/motion/motionMedia";
import { RegistrationChoice } from "@/components/registration/RegistrationChoice";

vi.setConfig({ testTimeout: 15_000 });

const STUDENT_TITLE = "Sou aluno";
const RECRUITER_TITLE = "Sou Recrutador";

describe("RegistrationChoice", () => {
  beforeEach(() => {
    stubMotionMedia("pointer");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("asks which profile the person wants, under the signup eyebrow", () => {
    render(<RegistrationChoice />);

    expect(screen.getByRole("heading", { level: 1, name: "Como deseja participar?" })).toBeTruthy();
    expect(screen.getByText("FAÇA PARTE DO TALENT VALLEY")).toBeTruthy();
    expect(screen.getByText("Escolha seu perfil para solicitar acesso ao Talent Valley.")).toBeTruthy();
  });

  it.each([
    {
      title: STUDENT_TITLE,
      href: "/cadastro/aluno",
      description: "Após aprovação, crie seu perfil profissional e apresente sua trajetória.",
    },
    {
      title: RECRUITER_TITLE,
      href: "/cadastro/recrutador",
      description: "Solicite acesso para descobrir talentos da comunidade Rio Pomba Valley.",
    },
  ])("offers $title as a link card to $href", ({ title, href, description }) => {
    render(<RegistrationChoice />);

    const heading = screen.getByRole("heading", { level: 2, name: title });
    const card = heading.closest("a") as HTMLAnchorElement;
    expect(card.getAttribute("href")).toBe(href);
    expect(within(card).getByText(description)).toBeTruthy();
    expect(card.querySelectorAll("svg[aria-hidden='true']").length).toBeGreaterThanOrEqual(2);
  });

  it("lists the student card before the recruiter card", () => {
    render(<RegistrationChoice />);

    const cards = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(cards).toEqual([STUDENT_TITLE, RECRUITER_TITLE]);
  });

  it("keeps a decorative light layer in each card", () => {
    render(<RegistrationChoice />);

    expect(document.querySelectorAll(".choice-glow[aria-hidden='true']")).toHaveLength(2);
  });

  it("footers the page with the login link and a way back to the home page", () => {
    render(<RegistrationChoice />);

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Entrar na plataforma" }).getAttribute("href")).toBe("/login");
    expect(within(footer).getByRole("link", { name: "Voltar para o início" }).getAttribute("href")).toBe("/");
  });
});
