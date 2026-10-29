import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import Page from "@/app/(app)/inicio/page";
import { STUDENT, expectViewInGuard } from "@/__tests__/app/(app)/guardedPage";

vi.mock("@/components/auth/ProtectedRoute", async () => ({ ProtectedRoute: (await import("@/__tests__/app/(app)/guardedPage")).ProtectedRouteStub }));
vi.mock("@/components/student/StudentHome", () => ({ StudentHome: () => <p>student home</p> }));

describe("student home page", () => {
  it("shows the student home inside the role guard, restricted to students", () => {
    render(<Page />);

    expectViewInGuard("student home", STUDENT);
  });
});
