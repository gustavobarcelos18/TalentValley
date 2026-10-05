import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Page from "@/app/(app)/recrutador/talentos/page";
import {
  RECRUITER,
  expectViewInGuardedShell,
  renderWhileViewSuspends,
} from "@/__tests__/app/(app)/guardedPage";

vi.mock("@/components/auth/ProtectedRoute", async () => ({ ProtectedRoute: (await import("@/__tests__/app/(app)/guardedPage")).ProtectedRouteStub }));
vi.mock("@/components/layout/AppShell", async () => ({ AppShell: (await import("@/__tests__/app/(app)/guardedPage")).AppShellStub }));
vi.mock("@/components/recruiter/TalentDiscoveryView", async () => {
  const { SuspendableView } = await import("@/__tests__/app/(app)/guardedPage");
  return { TalentDiscoveryView: () => <SuspendableView label="discovery view" /> };
});

describe("recruiter talent discovery page", () => {
  it("shows the talent discovery view inside the app shell, restricted to recruiters", () => {
    render(<Page />);

    expectViewInGuardedShell("discovery view", RECRUITER);
  });

  it("shows three loading skeletons while the view loads", () => {
    const skeletons = renderWhileViewSuspends(<Page />, "discovery view");

    expect(skeletons).toHaveLength(3);
  });
});
