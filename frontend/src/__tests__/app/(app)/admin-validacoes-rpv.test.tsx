import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import Page from "@/app/(app)/admin/validacoes-rpv/page";
import { ADMIN, expectViewInGuardedShell } from "@/__tests__/app/(app)/guardedPage";

vi.mock("@/components/auth/ProtectedRoute", async () => ({ ProtectedRoute: (await import("@/__tests__/app/(app)/guardedPage")).ProtectedRouteStub }));
vi.mock("@/components/layout/AppShell", async () => ({ AppShell: (await import("@/__tests__/app/(app)/guardedPage")).AppShellStub }));
vi.mock("@/components/admin/AdminViews", () => ({ AdminRpvValidationsView: () => <p>admin rpv validations view</p> }));

describe("admin RPV validations page", () => {
  it("shows the RPV validations view inside the app shell, restricted to admins", () => {
    render(<Page />);

    expectViewInGuardedShell("admin rpv validations view", ADMIN);
  });
});
