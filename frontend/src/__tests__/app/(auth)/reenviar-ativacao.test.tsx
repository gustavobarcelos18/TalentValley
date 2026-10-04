import { describe, vi } from "vitest";
import ReenviarAtivacaoPage from "@/app/(auth)/reenviar-ativacao/page";
import { registerEmailFormTests } from "./emailFormSuite";

vi.setConfig({ testTimeout: 15_000 });

const mocks = vi.hoisted(() => ({ resendActivation: vi.fn() }));

vi.mock("@/lib/auth", () => ({ resendActivation: mocks.resendActivation }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));

describe("resend activation page", () => {
  registerEmailFormTests({
    page: <ReenviarAtivacaoPage />,
    api: mocks.resendActivation,
    resolvedValue: undefined,
    eyebrow: "ATIVAÇÃO DE CONTA",
    title: "Receber novo link de ativação",
    subtitle: "Informe o e-mail da sua conta para receber um novo link",
    submit: "Enviar novo link",
    neutralMessage: "Se a conta estiver aguardando ativação, enviaremos um novo link para o e-mail informado.",
  });
});
