import { use, type ReactElement, type ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { expect } from "vitest";

// Shared stubs and assertions for the thin (app) pages, which only compose
// ProtectedRoute + AppShell + one view. Each page test mocks the three
// components itself and keeps its own `it`.
export const ADMIN = "ADMIN";
export const RECRUITER = "RECRUTADOR";
export const STUDENT = "ALUNO";
export const ANY_ROLE = "any";

export function ProtectedRouteStub({ allowedRoles, children }: { allowedRoles?: string[]; children: ReactNode }) {
  return (
    <div data-testid="protected-route" data-roles={allowedRoles?.join(",") ?? ANY_ROLE}>
      {children}
    </div>
  );
}

export function AppShellStub({ children }: { children: ReactNode }) {
  return <div data-testid="app-shell">{children}</div>;
}

// Asserts the page nests view inside AppShell inside ProtectedRoute, and that the
// route is restricted to exactly `roles` (ANY_ROLE when no restriction is passed).
export function expectViewInGuardedShell(view: string, roles: string) {
  const guard = screen.getByTestId("protected-route");
  expect(guard.getAttribute("data-roles")).toBe(roles);
  const shell = within(guard).getByTestId("app-shell");
  expect(within(shell).getByText(view)).toBeTruthy();
}

const suspense = { active: false };
const NEVER_RESOLVES = new Promise<never>(() => undefined);

// View stand-in that can be told to suspend, to exercise a page's Suspense fallback.
export function SuspendableView({ label }: { label: string }) {
  if (suspense.active) use(NEVER_RESOLVES);
  return <p>{label}</p>;
}

// Renders the page while its view suspends and returns the skeletons it shows
// inside the shell instead of the view.
export function renderWhileViewSuspends(page: ReactElement, view: string) {
  suspense.active = true;
  try {
    render(page);
  } finally {
    suspense.active = false;
  }
  const shell = within(screen.getByTestId("protected-route")).getByTestId("app-shell");
  expect(within(shell).queryByText(view)).toBeNull();
  return shell.querySelectorAll(".MuiSkeleton-root");
}
