import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import Page from "@/app/(app)/conta/page";
import { STUDENT, expectViewInGuard } from "@/__tests__/app/(app)/guardedPage";

vi.mock("@/components/auth/ProtectedRoute", async () => ({ ProtectedRoute: (await import("@/__tests__/app/(app)/guardedPage")).ProtectedRouteStub }));
vi.mock("@/components/account/StudentAccountView", () => ({ StudentAccountView: () => <p>student account</p> }));

describe("student account page", () => {
  it("shows the account view inside the role guard, restricted to students", () => {
    render(<Page />);

    expectViewInGuard("student account", STUDENT);
  });
});
