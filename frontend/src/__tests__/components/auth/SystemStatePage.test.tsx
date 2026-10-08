import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SystemStatePage } from "@/components/auth/SystemStatePage";
import type { SystemSceneKind } from "@/components/auth/SystemScene";

vi.mock("@/components/auth/SystemScene", () => ({
  SystemScene: ({ kind }: { kind: SystemSceneKind }) => <div data-testid="scene" data-kind={kind} />,
}));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));

const MESSAGE = "A página não foi encontrada.";

describe("SystemStatePage", () => {
  it("shows the eyebrow, title, scene and message, and moves focus to the message", () => {
    render(
      <SystemStatePage
        scene="lost"
        eyebrow="ERRO 404"
        title="Página não encontrada"
        message={MESSAGE}
        severity="info"
        action={{ label: "Voltar", href: "/" }}
      />,
    );

    expect(screen.getByText("ERRO 404")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Página não encontrada" })).not.toBeNull();
    expect(screen.getByTestId("scene").getAttribute("data-kind")).toBe("lost");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(MESSAGE);
    expect(alert.className).toContain("MuiAlert-colorInfo");
    expect(document.activeElement).toBe(alert);
  });

  it.each<["info" | "warning" | "error", string]>([
    ["info", "MuiAlert-colorInfo"],
    ["warning", "MuiAlert-colorWarning"],
    ["error", "MuiAlert-colorError"],
  ])("styles the message with the %s severity", (severity, className) => {
    render(
      <SystemStatePage scene="failed" eyebrow="E" title="T" message={MESSAGE} severity={severity} action={{ label: "Ir", href: "/" }} />,
    );

    expect(screen.getByRole("alert").className).toContain(className);
  });

  it("renders the action as a link when it has an href", () => {
    render(
      <SystemStatePage scene="locked" eyebrow="E" title="T" message={MESSAGE} severity="warning" action={{ label: "Ir para a área", href: "/admin" }} />,
    );

    expect(screen.getByRole("link", { name: "Ir para a área" }).getAttribute("href")).toBe("/admin");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders the action as a button that runs onClick when there is no href", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <SystemStatePage scene="failed" eyebrow="E" title="T" message={MESSAGE} severity="error" action={{ label: "Tentar de novo", onClick }} />,
    );
    expect(screen.queryByRole("link")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
