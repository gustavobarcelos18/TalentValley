import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthLayout, AuthShell } from "@/components/auth/AuthLayout";

const nav = vi.hoisted(() => ({ pathname: "/login" }));

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/components/auth/AuthBackdrop", () => ({
  AuthBackdrop: ({ entrance, compact, children }: { entrance: boolean; compact: boolean; children: ReactNode }) => (
    <div data-testid="backdrop" data-entrance={String(entrance)} data-compact={String(compact)}>
      {children}
    </div>
  ),
}));

function backdrop() {
  return screen.getByTestId("backdrop");
}

function cardOf(text: string) {
  return screen.getByText(text).parentElement as HTMLElement;
}

describe("AuthShell", () => {
  it("renders its children in a card inside the backdrop, without entrance by default", () => {
    render(
      <AuthShell>
        <p>formulário</p>
      </AuthShell>,
    );

    expect(backdrop().contains(screen.getByText("formulário"))).toBe(true);
    expect(backdrop().getAttribute("data-entrance")).toBe("false");
    expect(backdrop().getAttribute("data-compact")).toBe("false");
    expect(getComputedStyle(cardOf("formulário")).maxWidth).toBe("520px");
  });

  it("passes entrance on to the backdrop", () => {
    render(<AuthShell entrance>x</AuthShell>);

    expect(backdrop().getAttribute("data-entrance")).toBe("true");
  });

  it("uses the wide card and the compact backdrop for the wizards", () => {
    render(
      <AuthShell wide>
        <p>formulário</p>
      </AuthShell>,
    );

    expect(backdrop().getAttribute("data-compact")).toBe("true");
    expect(getComputedStyle(cardOf("formulário")).maxWidth).toBe("680px");
  });
});

describe("AuthLayout", () => {
  beforeEach(() => {
    nav.pathname = "/login";
  });

  it("wraps the page in the shell with the entrance animation", () => {
    render(
      <AuthLayout>
        <p>página</p>
      </AuthLayout>,
    );

    expect(backdrop().contains(screen.getByText("página"))).toBe(true);
    expect(backdrop().getAttribute("data-entrance")).toBe("true");
  });

  it.each(["/login", "/cadastro", "/esqueci-senha"])("keeps the regular card on %s", (pathname) => {
    nav.pathname = pathname;
    render(<AuthLayout>página</AuthLayout>);

    expect(backdrop().getAttribute("data-compact")).toBe("false");
  });

  it.each(["/cadastro/aluno", "/cadastro/recrutador"])("uses the wide card on the %s wizard", (pathname) => {
    nav.pathname = pathname;
    render(<AuthLayout>página</AuthLayout>);

    expect(backdrop().getAttribute("data-compact")).toBe("true");
  });
});
