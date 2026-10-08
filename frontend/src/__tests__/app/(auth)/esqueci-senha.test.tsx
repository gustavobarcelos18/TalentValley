import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import EsqueciSenhaPage from "@/app/(auth)/esqueci-senha/page";
import { registerEmailFormTests } from "./emailFormSuite";

vi.setConfig({ testTimeout: 15_000 });

const mocks = vi.hoisted(() => ({ forgotPassword: vi.fn() }));

vi.mock("@/lib/auth", () => ({ forgotPassword: mocks.forgotPassword }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));

describe("forgot password page", () => {
  it("shows the eyebrow, title and subtitle of the page", () => {
    render(<EsqueciSenhaPage />);
    expect(screen.getByText("RECUPERAR ACESSO")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Esqueci minha senha");
    expect(screen.getByText("Informe seu e-mail para receber as instruções de redefinição")).toBeTruthy();
  });

  registerEmailFormTests({
    page: <EsqueciSenhaPage />,
    api: mocks.forgotPassword,
    resolvedValue: { mensagem: "ok" },
    submit: "Enviar instruções",
    neutralMessage: "Se a conta for elegível, enviaremos as instruções para redefinir sua senha.",
  });
});
