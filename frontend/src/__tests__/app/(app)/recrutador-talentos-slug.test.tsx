import { render } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import Page from "@/app/(app)/recrutador/talentos/[slug]/page";
import { RECRUITER, expectViewInGuardedShell } from "@/__tests__/app/(app)/guardedPage";

vi.mock("@/components/auth/ProtectedRoute", async () => ({ ProtectedRoute: (await import("@/__tests__/app/(app)/guardedPage")).ProtectedRouteStub }));
vi.mock("@/components/layout/AppShell", async () => ({ AppShell: (await import("@/__tests__/app/(app)/guardedPage")).AppShellStub }));
vi.mock("next/navigation", () => ({ useParams: () => ({ slug: "maria-silva" }) }));
vi.mock("@/components/recruiter/TalentProfileView", () => ({ TalentProfileView: ({ slug }: { slug: string }) => <p>talent profile {slug}</p> }));

describe("recruiter talent profile page", () => {
  it("passes the slug from the route to the profile view, restricted to recruiters", () => {
    render(<Page />);

    expectViewInGuardedShell("talent profile maria-silva", RECRUITER);
  });
});
