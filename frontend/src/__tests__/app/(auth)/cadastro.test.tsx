import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RegistrationChoicePage from "@/app/(auth)/cadastro/page";
import StudentRegistrationPage from "@/app/(auth)/cadastro/aluno/page";
import RecruiterRegistrationPage from "@/app/(auth)/cadastro/recrutador/page";

const TEXT = vi.hoisted(() => ({ student: "cadastro de aluno", recruiter: "cadastro de recrutador" }));

vi.mock("@/components/registration/RegistrationChoice", () => ({ RegistrationChoice: () => <p>escolha de perfil</p> }));
vi.mock("@/components/registration/StudentRegistrationWizard", () => ({ StudentRegistrationWizard: () => <p>{TEXT.student}</p> }));
vi.mock("@/components/registration/RecruiterRegistrationWizard", () => ({ RecruiterRegistrationWizard: () => <p>{TEXT.recruiter}</p> }));

describe("registration routes", () => {
  it("shows the profile choice at /cadastro", () => {
    render(<RegistrationChoicePage />);
    expect(screen.getByText("escolha de perfil")).toBeTruthy();
    expect(screen.queryByText(TEXT.student)).toBeNull();
  });

  it("shows the student wizard at /cadastro/aluno", () => {
    render(<StudentRegistrationPage />);
    expect(screen.getByText(TEXT.student)).toBeTruthy();
    expect(screen.queryByText(TEXT.recruiter)).toBeNull();
  });

  it("shows the recruiter wizard at /cadastro/recrutador", () => {
    render(<RecruiterRegistrationPage />);
    expect(screen.getByText(TEXT.recruiter)).toBeTruthy();
    expect(screen.queryByText(TEXT.student)).toBeNull();
  });
});
