import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthResultPage } from "@/components/auth/AuthResultPage";

const SUCCESS_MARK = vi.hoisted(() => "success-mark");

vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));
vi.mock("@/components/auth/motion/SuccessMark", () => ({ SuccessMark: () => <div data-testid={SUCCESS_MARK} /> }));
vi.mock("@/components/auth/motion/buttonEffects", () => ({
  PulseRing: ({ iterations, delay }: { iterations?: number; delay?: number }) => (
    <span data-testid="pulse" data-iterations={iterations} data-delay={delay} />
  ),
  shimmerSx: {},
}));

const MESSAGE = "Senha alterada com sucesso.";

function renderResult(severity: "success" | "error", extra?: { footer?: string; subtitle?: string; eyebrow?: string }) {
  return render(
    <AuthResultPage
      title="Resultado"
      severity={severity}
      message={MESSAGE}
      actionHref="/login"
      actionLabel="Ir para o login"
      {...extra}
    />,
  );
}

describe("AuthResultPage", () => {
  it("shows the title, the message with focus, and the action link", () => {
    renderResult("success");

    expect(screen.getByRole("heading", { level: 1, name: "Resultado" })).not.toBeNull();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(MESSAGE);
    expect(document.activeElement).toBe(alert);
    expect(screen.getByRole("link", { name: "Ir para o login" }).getAttribute("href")).toBe("/login");
  });

  it("adds the success mark and a repeating pulse on the action for success", () => {
    renderResult("success");

    expect(screen.getByTestId(SUCCESS_MARK)).not.toBeNull();
    expect(screen.getByRole("alert").className).toContain("MuiAlert-colorSuccess");
    const pulse = screen.getByRole("link").querySelector('[data-testid="pulse"]');
    expect(pulse?.getAttribute("data-iterations")).toBe("3");
    expect(pulse?.getAttribute("data-delay")).toBe("1.2");
  });

  it("has neither the success mark nor the pulse for an error", () => {
    renderResult("error");

    expect(screen.queryByTestId(SUCCESS_MARK)).toBeNull();
    expect(screen.queryByTestId("pulse")).toBeNull();
    expect(screen.getByRole("alert").className).toContain("MuiAlert-colorError");
  });

  it("passes the subtitle, eyebrow and footer to the page", () => {
    renderResult("error", { subtitle: "Link inválido", eyebrow: "ATIVAÇÃO", footer: "Rodapé do resultado" });

    expect(screen.getByText("Link inválido")).not.toBeNull();
    expect(screen.getByText("ATIVAÇÃO")).not.toBeNull();
    expect(screen.getByRole("contentinfo").textContent).toBe("Rodapé do resultado");
  });
});
