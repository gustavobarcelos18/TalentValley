import { render } from "@testing-library/react";
import { use } from "react";
import { describe, vi } from "vitest";
import AtivarContaPage from "@/app/(auth)/ativar-conta/page";
import { registerPasswordFormTests } from "./passwordFormSuite";

vi.setConfig({ testTimeout: 15_000 });

const mocks = vi.hoisted(() => ({
  activateAccount: vi.fn(),
  params: new URLSearchParams(),
  suspend: false,
  pending: new Promise<never>(() => undefined),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => {
    if (mocks.suspend) use(mocks.pending);
    return mocks.params;
  },
}));
vi.mock("@/lib/auth", () => ({ activateAccount: mocks.activateAccount }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));

describe("account activation page", () => {
  registerPasswordFormTests({
    renderPage: (search) => {
      mocks.params = new URLSearchParams(search);
      render(<AtivarContaPage />);
    },
    setSuspend: (suspend) => {
      mocks.suspend = suspend;
    },
    api: mocks.activateAccount,
    passwordKey: "senha",
    passwordLabel: "Senha",
    confirmationLabel: "Confirmação da senha",
    submit: "Ativar minha conta",
    loading: "Ativando...",
    eyebrow: "ATIVAÇÃO DE CONTA",
    title: "Ativar conta",
    subtitle: "Defina sua senha para ativar seu acesso",
    doneTitle: "Conta ativada",
    doneMessage: "Conta ativada com sucesso! Você já pode fazer login.",
    fallbackMessage: "Não foi possível ativar a conta. Tente novamente.",
    incompleteMessage: "Este link de ativação está incompleto. Solicite um novo.",
    rejectedMessage: "Este link de ativação é inválido, expirou ou já foi usado. Solicite um novo.",
    newLinkHref: "/reenviar-ativacao",
    titles: {
      renders: "renders the password form for a complete link",
      submitsPayload: "activates the account with the e-mail and token from the link and the chosen password",
      confirmsDone: "confirms the activation and points to the login",
    },
  });
});
