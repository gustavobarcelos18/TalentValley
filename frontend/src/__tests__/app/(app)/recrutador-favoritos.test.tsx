import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Page from "@/app/(app)/recrutador/favoritos/page";
import {
  RECRUITER,
  expectViewInGuardedShell,
  renderWhileViewSuspends,
} from "@/__tests__/app/(app)/guardedPage";

vi.mock("@/components/auth/ProtectedRoute", async () => ({ ProtectedRoute: (await import("@/__tests__/app/(app)/guardedPage")).ProtectedRouteStub }));
vi.mock("@/components/layout/AppShell", async () => ({ AppShell: (await import("@/__tests__/app/(app)/guardedPage")).AppShellStub }));
vi.mock("@/components/recruiter/FavoritesView", async () => {
  const { SuspendableView } = await import("@/__tests__/app/(app)/guardedPage");
  return { FavoritesView: () => <SuspendableView label="favorites view" /> };
});

describe("recruiter favorites page", () => {
  it("shows the favorites view inside the app shell, restricted to recruiters", () => {
    render(<Page />);

    expectViewInGuardedShell("favorites view", RECRUITER);
  });

  it("shows a loading skeleton while the view loads", () => {
    const skeletons = renderWhileViewSuspends(<Page />, "favorites view");

    expect(skeletons).toHaveLength(1);
  });
});
