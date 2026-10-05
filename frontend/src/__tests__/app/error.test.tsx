import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RouteError from "@/app/error";

vi.mock("@/components/auth/AuthLayout", () => ({ AuthShell: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/auth/SystemScene", () => ({ SystemScene: () => null }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));

const INTERNAL_DETAIL = "db password leaked";

function renderError(retry = vi.fn()) {
  render(<RouteError error={new Error(INTERNAL_DETAIL)} retry={retry} />);
  return retry;
}

describe("route error page", () => {
  it("announces a generic failure without exposing the error details", () => {
    renderError();

    expect(screen.getByText("ERRO INESPERADO")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Algo deu errado" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Não foi possível carregar esta página. Tente novamente em instantes.");
    expect(screen.queryByText(INTERNAL_DETAIL)).toBeNull();
  });

  it("retries when the user asks to try again", async () => {
    const retry = renderError();

    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
