import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Page from "@/app/aceitar-termos/page";
import { expectViewInGuard } from "@/__tests__/app/(app)/guardedPage";

vi.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({
    allowedRoles,
    allowPendingTerms,
    children,
  }: {
    allowedRoles?: string[];
    allowPendingTerms?: boolean;
    children: ReactNode;
  }) => (
    <div data-testid="protected-route" data-roles={allowedRoles?.join(",")} data-allow-pending={String(allowPendingTerms)}>
      {children}
    </div>
  ),
}));
vi.mock("@/components/account/AcceptTermsScreen", () => ({ AcceptTermsScreen: () => <p>accept terms screen</p> }));

describe("terms acceptance page", () => {
  it("shows the screen inside the guard, restricted to students and recruiters", () => {
    render(<Page />);

    expectViewInGuard("accept terms screen", "ALUNO,RECRUTADOR");
  });

  it("is the only guard that lets pending terms through, so it never redirects to itself", () => {
    render(<Page />);

    expect(screen.getByTestId("protected-route").getAttribute("data-allow-pending")).toBe("true");
  });
});
