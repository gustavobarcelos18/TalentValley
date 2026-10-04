import { vi } from "vitest";
import EsqueciSenhaPage from "@/app/(auth)/esqueci-senha/page";
import { describeEmailFormPage } from "./emailFormSuite";

vi.setConfig({ testTimeout: 15_000 });

const mocks = vi.hoisted(() => ({ forgotPassword: vi.fn() }));

vi.mock("@/lib/auth", () => ({ forgotPassword: mocks.forgotPassword }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));

describeEmailFormPage({
  suiteName: "forgot password page",
  page: <EsqueciSenhaPage />,
  api: mocks.forgotPassword,
  resolvedValue: { mensagem: "ok" },
  eyebrow: "RECUPERAR ACESSO",
  title: "Esqueci minha senha",
  subtitle: "Informe seu e-mail para receber as instruções de redefinição",
  submit: "Enviar instruções",
  neutralMessage: "Se a conta for elegível, enviaremos as instruções para redefinir sua senha.",
});
