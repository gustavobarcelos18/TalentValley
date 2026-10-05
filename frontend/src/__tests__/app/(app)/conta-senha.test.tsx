import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import Page from "@/app/(app)/conta/senha/page";
import { ANY_ROLE, expectViewInGuardedShell } from "@/__tests__/app/(app)/guardedPage";

vi.mock("@/components/auth/ProtectedRoute", async () => ({ ProtectedRoute: (await import("@/__tests__/app/(app)/guardedPage")).ProtectedRouteStub }));
vi.mock("@/components/layout/AppShell", async () => ({ AppShell: (await import("@/__tests__/app/(app)/guardedPage")).AppShellStub }));
vi.mock("@/components/account/ChangePasswordForm", () => ({ ChangePasswordForm: () => <p>change password form</p> }));

describe("change password page", () => {
  it("shows the password form inside the app shell, restricted to any signed-in user", () => {
    render(<Page />);

    expectViewInGuardedShell("change password form", ANY_ROLE);
  });
});
