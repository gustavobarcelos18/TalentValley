import { render } from "@testing-library/react";
import { use } from "react";
import { vi } from "vitest";
import RedefinirSenhaPage from "@/app/(auth)/redefinir-senha/page";
import { describePasswordFormPage } from "./passwordFormSuite";

vi.setConfig({ testTimeout: 15_000 });

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
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
vi.mock("@/lib/auth", () => ({ resetPassword: mocks.resetPassword }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));

describePasswordFormPage({
  suiteName: "password reset page",
  renderPage: (search) => {
    mocks.params = new URLSearchParams(search);
    render(<RedefinirSenhaPage />);
  },
  setSuspend: (suspend) => {
    mocks.suspend = suspend;
  },
  api: mocks.resetPassword,
  passwordKey: "novaSenha",
  passwordLabel: "Nova senha",
  confirmationLabel: "Confirmação da nova senha",
  submit: "Redefinir senha",
  loading: "Redefinindo...",
  eyebrow: "RECUPERAR ACESSO",
  title: "Redefinir senha",
  subtitle: "Digite sua nova senha",
  doneTitle: "Senha redefinida",
  doneMessage: "Sua senha foi redefinida com sucesso.",
  fallbackMessage: "Não foi possível redefinir a senha. Tente novamente.",
  incompleteMessage: "Este link de redefinição está incompleto. Solicite um novo.",
  rejectedMessage: "Este link de redefinição é inválido, expirou ou já foi usado. Solicite um novo.",
  newLinkHref: "/esqueci-senha",
  titles: {
    renders: "renders the new password form for a complete link",
    submitsPayload: "resets the password with the e-mail and token from the link and the new password",
    confirmsDone: "confirms the reset and points to the login",
  },
});
