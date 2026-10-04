import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthSubmitButton } from "@/components/auth/AuthSubmitButton";
import type { RetryCountdown } from "@/components/auth/motion/useRetryCountdown";

const motionState = vi.hoisted(() => ({ reduced: false }));

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => motionState.reduced,
}));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => "reduced" }));
vi.mock("@/components/auth/motion/buttonEffects", () => ({
  PulseRing: () => <span data-testid="pulse" />,
  shimmerSx: {},
}));

const LABEL = "Entrar";
const LOADING_LABEL = "Entrando...";
const PULSE = "pulse";

function retryOf(overrides: Partial<RetryCountdown>): RetryCountdown {
  return { remaining: 0, total: 0, finished: 0, observe: vi.fn(), ...overrides };
}

function renderButton(props: Partial<ComponentProps<typeof AuthSubmitButton>> = {}) {
  return render(
    <AuthSubmitButton loadingLabel={LOADING_LABEL} {...props}>
      {LABEL}
    </AuthSubmitButton>,
  );
}

function button() {
  return screen.getByRole("button") as HTMLButtonElement;
}

describe("AuthSubmitButton", () => {
  beforeEach(() => {
    motionState.reduced = false;
  });

  it("is an enabled submit button with its label when idle", () => {
    renderButton();

    expect(button().type).toBe("submit");
    expect(button().disabled).toBe(false);
    expect(button().textContent).toBe(LABEL);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByTestId(PULSE)).toBeNull();
  });

  it("is disabled and announces the loading label with a spinner while loading", () => {
    renderButton({ loading: true });

    expect(button().disabled).toBe(true);
    expect(button().type).toBe("submit");
    expect(button().querySelector('[role="progressbar"]')?.getAttribute("aria-hidden")).toBe("true");
    expect(button().textContent).toBe(LOADING_LABEL);
  });

  it("shows the drawn check as a non-submit, enabled button on success, even while loading", () => {
    renderButton({ loading: true, success: true });

    expect(button().type).toBe("button");
    expect(button().disabled).toBe(false);
    expect(button().textContent).toBe(LOADING_LABEL);
    expect(button().querySelector("svg path")).not.toBeNull();
    expect(button().querySelector('[role="progressbar"]')).toBeNull();
  });

  it.each<[number, string]>([
    [30, "Tente de novo em 30 s"],
    [59, "Tente de novo em 59 s"],
    [60, "Tente de novo em 1:00"],
    [65, "Tente de novo em 1:05"],
    [125, "Tente de novo em 2:05"],
  ])("disables the button and counts down when rate limited (%i s)", (remaining, text) => {
    renderButton({ retry: retryOf({ remaining, total: 125 }) });

    expect(button().disabled).toBe(true);
    expect(button().textContent).toBe(text);
  });

  it("draws the countdown ring proportionally to the time left", () => {
    renderButton({ retry: retryOf({ remaining: 15, total: 30 }) });

    const progress = button().querySelectorAll("circle")[1];
    const length = 2 * Math.PI * 9;
    expect(Number(progress.getAttribute("stroke-dasharray"))).toBeCloseTo(length);
    expect(Number(progress.getAttribute("stroke-dashoffset"))).toBeCloseTo(length / 2);
    expect(progress.getAttribute("style")).toContain("transition");
  });

  it("drops the ring transition with reduced motion", () => {
    motionState.reduced = true;
    renderButton({ retry: retryOf({ remaining: 15, total: 30 }) });

    expect(button().querySelectorAll("circle")[1].getAttribute("style")).toBeNull();
  });

  it("keeps the loading spinner over the countdown when both apply", () => {
    renderButton({ loading: true, retry: retryOf({ remaining: 10, total: 30 }) });

    expect(button().querySelector('[role="progressbar"]')).not.toBeNull();
    expect(button().textContent).toBe(LOADING_LABEL);
  });

  it("does not wait once the countdown is over and shows a pulse for the finished wait", () => {
    renderButton({ retry: retryOf({ remaining: 0, total: 30, finished: 1 }) });

    expect(button().disabled).toBe(false);
    expect(button().textContent).toBe(LABEL);
    expect(screen.getAllByTestId(PULSE)).toHaveLength(1);
  });

  it("replays the pulse for each finished wait by remounting it", () => {
    const { rerender } = renderButton({ retry: retryOf({ remaining: 0, total: 30, finished: 1 }) });
    const first = screen.getByTestId(PULSE);

    rerender(
      <AuthSubmitButton loadingLabel={LOADING_LABEL} retry={retryOf({ remaining: 0, total: 30, finished: 2 })}>
        {LABEL}
      </AuthSubmitButton>,
    );

    expect(screen.getByTestId(PULSE)).not.toBe(first);
  });

  it("shows no pulse while a new wait is running", () => {
    renderButton({ retry: retryOf({ remaining: 20, total: 30, finished: 1 }) });

    expect(screen.queryByTestId(PULSE)).toBeNull();
  });
});
