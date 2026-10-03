import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingPage } from "@/components/landing/LandingPage";

vi.mock("@/components/landing/LandingRoot", () => ({ LandingRoot: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/landing/PublicHeader", () => ({ PublicHeader: () => <header>cabeçalho</header> }));
vi.mock("@/components/landing/Brand", () => ({ Brand: () => <span>marca</span> }));
vi.mock("@/components/landing/HowItWorks", () => ({ HowItWorks: () => <div>passos</div> }));
vi.mock("@/components/landing/ValleyScene", () => ({
  ValleyScene: () => <svg />,
  SceneContours: () => <g />,
  SceneConnections: () => <g />,
}));
vi.mock("@/components/landing/ProductPreview", () => ({ ProductPreview: ({ audience }: { audience: string }) => <div>prévia {audience}</div> }));
vi.mock("@/components/landing/LandingActions", () => ({
  HeroActions: () => <div>ações do hero</div>,
  JoinActions: ({ audience }: { audience: string }) => <div>ações {audience}</div>,
  FooterAccessLink: () => <a href="/login">acesso</a>,
}));
vi.mock("next/image", () => ({ default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }));

describe("LandingPage", () => {
  it("renders the hero headline and the skip link", () => {
    render(<LandingPage />);
    const headline = screen.getByRole("heading", { level: 1 });
    expect(headline.textContent).toContain("Talento encontra");
    expect(headline.textContent).toContain("oportunidade aqui.");
    expect(screen.getByRole("link", { name: "Pular para o conteúdo" }).getAttribute("href")).toBe("#conteudo");
  });

  it("renders one section per landing story", () => {
    const { container } = render(<LandingPage />);
    const ids = [...container.querySelectorAll("main > section")].map((section) => section.id);
    expect(ids).toEqual(["hero", "proposta", "talentos", "recrutadores", "como-funciona", "rio-pomba-valley"]);
  });

  it("explains the three value propositions", () => {
    render(<LandingPage />);
    const titles = screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
    expect(titles).toEqual(["Perfil privado", "Acesso analisado", "Formação RPV verificada"]);
  });

  it("gives each audience its own previews and actions", () => {
    render(<LandingPage />);
    expect(screen.getByText("prévia talent")).toBeTruthy();
    expect(screen.getByText("prévia company")).toBeTruthy();
    expect(screen.getByText("ações talent")).toBeTruthy();
    expect(screen.getByText("ações company")).toBeTruthy();
    expect(screen.getByText("ações do hero")).toBeTruthy();
  });

  it("shows the institutional brand and the legal links in the footer", () => {
    render(<LandingPage />);
    expect(screen.getByRole("img", { name: /Rio Pomba Valley MG\.BR/ })).toBeTruthy();
    const legal = within(screen.getByRole("navigation", { name: "Documentos legais" }));
    expect(legal.getByRole("link", { name: "Política de Privacidade" }).getAttribute("href")).toBe("/privacidade");
    expect(legal.getByRole("link", { name: "Termos de Uso" }).getAttribute("href")).toBe("/termos");
  });
});
