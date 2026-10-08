import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMotionMedia } from "@/__tests__/components/auth/motion/motionMedia";
import { RegistrationSuccess } from "@/components/registration/RegistrationSuccess";

vi.setConfig({ testTimeout: 15_000 });

describe("RegistrationSuccess", () => {
  beforeEach(() => {
    stubMotionMedia("reduced");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("confirms the request with a neutral message and focuses it", () => {
    render(<RegistrationSuccess />);

    expect(screen.getByRole("heading", { level: 1, name: "Solicitação recebida" })).toBeTruthy();
    expect(screen.getByText("FAÇA PARTE DO TALENT VALLEY")).toBeTruthy();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Sua solicitação foi enviada e será analisada pela equipe do Talent Valley.");
    expect(document.activeElement).toBe(alert);
  });

  it("offers a single way back to the home page", () => {
    render(<RegistrationSuccess />);

    expect(screen.getByRole("link", { name: "Voltar à página inicial" }).getAttribute("href")).toBe("/");
  });
});
