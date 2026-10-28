import { screen } from "@testing-library/react";
import { renderThemed as render } from "../recruiter/renderThemed";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudentAccountView } from "@/components/account/StudentAccountView";
import { fetchMyDataExport, fetchMyNewsletter, saveMyNewsletter } from "@/lib/student";

const authState = vi.hoisted(() => ({ demo: false }));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { modoDemonstracao: authState.demo } }),
}));
vi.mock("@/components/account/PrivacidadeSection", () => ({
  PrivacidadeSection: (props: { fetchData: unknown; fetchNewsletter: unknown; saveNewsletter: unknown }) => (
    <p
      data-uses-student-export={String(props.fetchData === fetchMyDataExport)}
      data-uses-student-newsletter={String(
        props.fetchNewsletter === fetchMyNewsletter && props.saveNewsletter === saveMyNewsletter
      )}
    >
      privacy section
    </p>
  ),
}));
vi.mock("@/components/profile/ExclusaoSection", () => ({ ExclusaoSection: () => <p>delete section</p> }));

beforeEach(() => {
  authState.demo = false;
});

describe("StudentAccountView", () => {
  it("has the page title as its only main heading", () => {
    render(<StudentAccountView />);

    expect(screen.getByRole("heading", { level: 1, name: "Minha conta" })).toBeTruthy();
  });

  it("offers the password change as a link to the existing screen", () => {
    render(<StudentAccountView />);

    expect(screen.getByRole("heading", { name: "Senha" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Alterar senha" }).getAttribute("href")).toBe("/conta/senha");
  });

  it("shows privacy and account deletion", () => {
    render(<StudentAccountView />);

    expect(screen.getByText("privacy section")).toBeTruthy();
    expect(screen.getByText("delete section")).toBeTruthy();
  });

  it("uses the student's own export and newsletter, never the recruiter's", () => {
    render(<StudentAccountView />);

    const section = screen.getByText("privacy section");
    expect(section.getAttribute("data-uses-student-export")).toBe("true");
    expect(section.getAttribute("data-uses-student-newsletter")).toBe("true");
  });

  it("hides the password card in a demonstration account, as the account menu does", () => {
    authState.demo = true;

    render(<StudentAccountView />);

    expect(screen.queryByRole("heading", { name: "Senha" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Alterar senha" })).toBeNull();
  });
});
