import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthCheckError } from "@/components/auth/AuthCheckError";

const MESSAGE = "Não foi possível verificar sua sessão. Tente novamente.";

describe("AuthCheckError", () => {
  it("shows the message as a warning alert", () => {
    render(<AuthCheckError message={MESSAGE} onRetry={vi.fn()} />);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(MESSAGE);
    expect(alert.className).toContain("MuiAlert-colorWarning");
  });

  it("calls onRetry once per click on the retry button", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<AuthCheckError message={MESSAGE} onRetry={onRetry} />);
    expect(onRetry).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
