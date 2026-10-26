import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Page from "@/app/(app)/recrutador/comparar/tabela/page";
import {
  RECRUITER,
  expectViewInGuard,
  renderWhileViewSuspends,
} from "@/__tests__/app/(app)/guardedPage";

vi.mock("@/components/auth/ProtectedRoute", async () => ({ ProtectedRoute: (await import("@/__tests__/app/(app)/guardedPage")).ProtectedRouteStub }));
vi.mock("@/components/recruiter/TalentComparisonTableView", async () => {
  const { SuspendableView } = await import("@/__tests__/app/(app)/guardedPage");
  return { TalentComparisonTableView: () => <SuspendableView label="comparison table view" /> };
});

describe("recruiter comparison table page", () => {
  it("shows the table view inside the role guard, restricted to recruiters", () => {
    render(<Page />);

    expectViewInGuard("comparison table view", RECRUITER);
  });

  it("shows a loading skeleton while the view loads", () => {
    const skeletons = renderWhileViewSuspends(<Page />, "comparison table view");

    expect(skeletons).toHaveLength(1);
  });
});
