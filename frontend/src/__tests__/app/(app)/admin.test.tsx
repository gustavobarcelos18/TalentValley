import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import Page from "@/app/(app)/admin/page";
import { ADMIN, expectViewInGuardedShell } from "@/__tests__/app/(app)/guardedPage";

vi.mock("@/components/auth/ProtectedRoute", async () => ({ ProtectedRoute: (await import("@/__tests__/app/(app)/guardedPage")).ProtectedRouteStub }));
vi.mock("@/components/layout/AppShell", async () => ({ AppShell: (await import("@/__tests__/app/(app)/guardedPage")).AppShellStub }));
vi.mock("@/components/admin/AdminViews", () => ({ AdminDashboardView: () => <p>admin dashboard view</p> }));

describe("admin dashboard page", () => {
  it("shows the dashboard view inside the app shell, restricted to admins", () => {
    render(<Page />);

    expectViewInGuardedShell("admin dashboard view", ADMIN);
  });
});
