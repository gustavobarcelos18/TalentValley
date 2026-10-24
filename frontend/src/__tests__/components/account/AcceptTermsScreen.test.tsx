import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderThemed as render } from "../recruiter/renderThemed";
import { AcceptTermsScreen } from "@/components/account/AcceptTermsScreen";
import { acceptTerms } from "@/lib/auth";
import * as recruiterApi from "@/lib/recruiter";
import * as studentApi from "@/lib/student";
import type { UsuarioAutenticado, UserRole } from "@/types/auth";

const mocks = vi.hoisted(() => ({
  auth: null as unknown as {
    user: UsuarioAutenticado | null;
    error?: string | null;
    refreshUser: () => Promise<void>;
    logout: () => Promise<void>;
  },
  router: { replace: vi.fn() },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => mocks.auth }));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/auth", () => ({ acceptTerms: vi.fn() }));
vi.mock("@/lib/student", () => ({
  fetchMyDataExport: vi.fn(),
  fetchMyNewsletter: vi.fn(),
  saveMyNewsletter: vi.fn(),
}));
vi.mock("@/lib/recruiter", () => ({
  fetchMyDataExport: vi.fn(),
  fetchMyNewsletter: vi.fn(),
  saveMyNewsletter: vi.fn(),
}));
vi.mock("@/components/account/PrivacidadeSection", () => ({
  PrivacidadeSection: (props: { fetchData: unknown; fetchNewsletter: unknown; saveNewsletter: unknown }) => (
    <p
      data-student={String(
        props.fetchData === studentApi.fetchMyDataExport &&
          props.fetchNewsletter === studentApi.fetchMyNewsletter &&
          props.saveNewsletter === studentApi.saveMyNewsletter
      )}
      data-recruiter={String(
        props.fetchData === recruiterApi.fetchMyDataExport &&
          props.fetchNewsletter === recruiterApi.fetchMyNewsletter &&
          props.saveNewsletter === recruiterApi.saveMyNewsletter
      )}
    >
      privacy section
    </p>
  ),
}));
vi.mock("@/components/profile/ExclusaoSection", () => ({ ExclusaoSection: () => <p>delete section</p> }));

const ACCEPT_BUTTON = "Aceitar e continuar";
const CONSENT_LABEL = /Eu li e concordo/;
const FAILURE = "Não foi possível registrar o aceite. Tente novamente.";

function pendingUser(role: UserRole): UsuarioAutenticado {
  return { id: "1", nome: "Ana", email: "ana@example.com", role, termosPendentes: true, modoDemonstracao: false };
}

function setAuth(user: UsuarioAutenticado | null, error: string | null = null) {
  mocks.auth = {
    user,
    error,
    refreshUser: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
  };
}

describe("AcceptTermsScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setAuth(pendingUser("ALUNO"));
  });

  it("asks for the acceptance with the button disabled until the box is checked", async () => {
    const user = userEvent.setup();
    render(<AcceptTermsScreen />);

    expect(screen.getByRole("heading", { level: 1, name: /Aceite os Termos de Uso/ })).toBeTruthy();
    const button = screen.getByRole("button", { name: ACCEPT_BUTTON }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    await user.click(screen.getByRole("checkbox", { name: CONSENT_LABEL }));

    expect(button.disabled).toBe(false);
  });

  it("records the acceptance and then reloads the session, without a manual redirect", async () => {
    const user = userEvent.setup();
    vi.mocked(acceptTerms).mockResolvedValue(undefined);
    render(<AcceptTermsScreen />);

    await user.click(screen.getByRole("checkbox", { name: CONSENT_LABEL }));
    await user.click(screen.getByRole("button", { name: ACCEPT_BUTTON }));

    await waitFor(() => expect(mocks.auth.refreshUser).toHaveBeenCalledTimes(1));
    expect(acceptTerms).toHaveBeenCalledTimes(1);
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("shows the failure and does not reload the session when the acceptance is not recorded", async () => {
    const user = userEvent.setup();
    vi.mocked(acceptTerms).mockRejectedValue(new Error("sem rede"));
    render(<AcceptTermsScreen />);

    await user.click(screen.getByRole("checkbox", { name: CONSENT_LABEL }));
    await user.click(screen.getByRole("button", { name: ACCEPT_BUTTON }));

    expect((await screen.findByRole("alert")).textContent).toContain("sem rede");
    expect(mocks.auth.refreshUser).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: ACCEPT_BUTTON }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("uses the generic failure text when the error has no usable message", async () => {
    const user = userEvent.setup();
    vi.mocked(acceptTerms).mockRejectedValue("falhou");
    render(<AcceptTermsScreen />);

    await user.click(screen.getByRole("checkbox", { name: CONSENT_LABEL }));
    await user.click(screen.getByRole("button", { name: ACCEPT_BUTTON }));

    expect((await screen.findByRole("alert")).textContent).toBe(FAILURE);
  });

  it("shows the session error when the session could not be reloaded after the acceptance", () => {
    setAuth(pendingUser("ALUNO"), "Não foi possível verificar sua sessão. Tente novamente.");
    render(<AcceptTermsScreen />);

    expect(screen.getByRole("alert").textContent).toBe("Não foi possível verificar sua sessão. Tente novamente.");
  });

  it("lets the person leave without accepting", async () => {
    const user = userEvent.setup();
    render(<AcceptTermsScreen />);

    await user.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/login"));
    expect(mocks.auth.logout).toHaveBeenCalledTimes(1);
    expect(acceptTerms).not.toHaveBeenCalled();
  });

  it("offers a student the student's own privacy tools and the account deletion", () => {
    render(<AcceptTermsScreen />);

    const section = screen.getByText("privacy section");
    expect(section.getAttribute("data-student")).toBe("true");
    expect(section.getAttribute("data-recruiter")).toBe("false");
    expect(screen.getByText("delete section")).toBeTruthy();
  });

  it("offers a recruiter the recruiter's own privacy tools and no deletion screen", () => {
    setAuth(pendingUser("RECRUTADOR"));
    render(<AcceptTermsScreen />);

    const section = screen.getByText("privacy section");
    expect(section.getAttribute("data-recruiter")).toBe("true");
    expect(section.getAttribute("data-student")).toBe("false");
    expect(screen.queryByText("delete section")).toBeNull();
  });

  it.each<[UserRole, string]>([
    ["ALUNO", "/meu-perfil"],
    ["RECRUTADOR", "/recrutador"],
    ["ADMIN", "/admin"],
  ])("sends a %s with nothing pending to their own area and renders nothing", (role, destination) => {
    setAuth({ ...pendingUser(role), termosPendentes: false });
    const { container } = render(<AcceptTermsScreen />);

    expect(mocks.router.replace).toHaveBeenCalledWith(destination);
    expect(container.textContent).toBe("");
  });

  it("renders nothing and does not redirect while nobody is signed in", () => {
    setAuth(null);
    const { container } = render(<AcceptTermsScreen />);

    expect(container.textContent).toBe("");
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });
});
