import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecruiterAccountDeletion } from "@/components/account/RecruiterAccountDeletion";
import { deleteOwnRecruiterAccount } from "@/lib/recruiter";
import type { UserRole } from "@/types/auth";

let currentRole: UserRole | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: currentRole ? { role: currentRole } : null, logout: vi.fn() }),
}));

vi.mock("@/lib/recruiter", () => ({
  deleteOwnRecruiterAccount: vi.fn(),
}));

const deleteMock = vi.mocked(deleteOwnRecruiterAccount);

beforeEach(() => {
  vi.resetAllMocks();
  currentRole = null;
});

describe("RecruiterAccountDeletion", () => {
  it.each<[string, UserRole | null]>([
    ["students", "ALUNO"],
    ["admins", "ADMIN"],
    ["a user that is not loaded yet", null],
  ])("renders nothing for %s", (_name, role) => {
    currentRole = role;

    const { container } = render(<RecruiterAccountDeletion />);

    expect(container.firstChild).toBeNull();
  });

  it("shows the recruiter warning and deletes through the recruiter endpoint helper", async () => {
    currentRole = "RECRUTADOR";
    deleteMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RecruiterAccountDeletion />);

    expect(screen.getByRole("heading", { level: 2, name: "Excluir conta" })).toBeTruthy();
    expect(screen.getByText(/seus favoritos/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    await user.type(await screen.findByLabelText(/Senha atual/), "SenhaForte#1");
    await user.click(screen.getByRole("button", { name: "Excluir definitivamente" }));

    expect(await screen.findByRole("status")).toBeTruthy();
    expect(deleteMock).toHaveBeenCalledWith("SenhaForte#1");
  });
});
