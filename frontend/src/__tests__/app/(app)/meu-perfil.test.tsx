import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import Page from "@/app/(app)/meu-perfil/page";
import { STUDENT, expectViewInGuardedShell } from "@/__tests__/app/(app)/guardedPage";

vi.mock("@/components/auth/ProtectedRoute", async () => ({ ProtectedRoute: (await import("@/__tests__/app/(app)/guardedPage")).ProtectedRouteStub }));
vi.mock("@/components/layout/AppShell", async () => ({ AppShell: (await import("@/__tests__/app/(app)/guardedPage")).AppShellStub }));
vi.mock("@/components/profile/StudentProfile", () => ({ StudentProfile: () => <p>student profile</p> }));

describe("my profile page", () => {
  it("shows the student profile inside the app shell, restricted to students", () => {
    render(<Page />);

    expectViewInGuardedShell("student profile", STUDENT);
  });
});
