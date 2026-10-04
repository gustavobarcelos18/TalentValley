import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthSuspenseFallback } from "@/components/auth/AuthSuspenseFallback";

describe("AuthSuspenseFallback", () => {
  it("announces the loading state politely with a spinner", () => {
    render(<AuthSuspenseFallback />);

    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("Carregando...");
    expect(status.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it("sits inside the bare page frame, without a card or heading", () => {
    render(<AuthSuspenseFallback />);

    expect(screen.getByRole("main").contains(screen.getByRole("status"))).toBe(true);
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
