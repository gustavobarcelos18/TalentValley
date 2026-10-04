import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthRouteLayout from "@/app/(auth)/layout";

vi.mock("@/components/auth/GuestOnly", () => ({
  GuestOnly: ({ children }: { children: ReactNode }) => <div data-testid="guest-only">{children}</div>,
}));
vi.mock("@/components/auth/AuthLayout", () => ({
  AuthLayout: ({ children }: { children: ReactNode }) => <div data-testid="auth-layout">{children}</div>,
}));

describe("auth route layout", () => {
  it("shows the page inside the auth card, and the card only to guests", () => {
    render(
      <AuthRouteLayout>
        <p>conteúdo</p>
      </AuthRouteLayout>,
    );

    const guestOnly = screen.getByTestId("guest-only");
    const authLayout = screen.getByTestId("auth-layout");
    expect(guestOnly.firstElementChild).toBe(authLayout);
    expect(authLayout.firstElementChild?.textContent).toBe("conteúdo");
  });
});
