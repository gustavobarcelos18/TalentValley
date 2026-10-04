import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ReenviarAtivacaoPage from "@/app/(auth)/reenviar-ativacao/page";
import { registerEmailFormTests } from "./emailFormSuite";

vi.setConfig({ testTimeout: 15_000 });

const mocks = vi.hoisted(() => ({ resendActivation: vi.fn() }));

vi.mock("@/lib/auth", () => ({ resendActivation: mocks.resendActivation }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));

describe("resend activation page", () => {
  it("shows the eyebrow, title and subtitle of the page", () => {
    render(<ReenviarAtivacaoPage />);
    expect(screen.getByText("ATIVAÇÃO DE CONTA")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Receber novo link de ativação");
    expect(screen.getByText("Informe o e-mail da sua conta para receber um novo link")).toBeTruthy();
  });

  registerEmailFormTests({
    page: <ReenviarAtivacaoPage />,
    api: mocks.resendActivation,
    resolvedValue: undefined,
    submit: "Enviar novo link",
    neutralMessage: "Se a conta estiver aguardando ativação, enviaremos um novo link para o e-mail informado.",
  });
});
