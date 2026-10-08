import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import Page from "@/app/(app)/recrutador/page";
import { RECRUITER, expectViewInGuardedShell } from "@/__tests__/app/(app)/guardedPage";

vi.mock("@/components/auth/ProtectedRoute", async () => ({ ProtectedRoute: (await import("@/__tests__/app/(app)/guardedPage")).ProtectedRouteStub }));
vi.mock("@/components/layout/AppShell", async () => ({ AppShell: (await import("@/__tests__/app/(app)/guardedPage")).AppShellStub }));
vi.mock("@/components/recruiter/RecruiterDashboardView", () => ({ RecruiterDashboardView: () => <p>recruiter dashboard view</p> }));

describe("recruiter dashboard page", () => {
  it("shows the dashboard view inside the app shell, restricted to recruiters", () => {
    render(<Page />);

    expectViewInGuardedShell("recruiter dashboard view", RECRUITER);
  });
});
