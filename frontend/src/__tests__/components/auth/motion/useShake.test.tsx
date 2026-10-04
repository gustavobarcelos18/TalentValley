import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { duration, ease } from "@/components/auth/motion/tokens";
import { useShake } from "@/components/auth/motion/useShake";
import { shakeKeyframes } from "@/components/auth/motion/variants";
import { stubMotionMedia } from "./motionMedia";

const framer = vi.hoisted(() => ({
  scope: { current: null as HTMLElement | null },
  animate: vi.fn(),
}));

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useAnimate: () => [framer.scope, framer.animate],
}));

const BOX = "shake-box";

function Shaker({ trigger }: { trigger: number }) {
  const ref = useShake<HTMLDivElement>(trigger);
  return <div ref={ref} data-testid={BOX} />;
}

function Detached({ trigger }: { trigger: number }) {
  useShake<HTMLDivElement>(trigger);
  return null;
}

function box() {
  return screen.getByTestId(BOX);
}

beforeEach(() => {
  framer.scope.current = null;
  framer.animate.mockReset();
  framer.animate.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useShake", () => {
  it("does not shake on mount, while the trigger is zero", () => {
    stubMotionMedia("pointer");
    render(<Shaker trigger={0} />);
    expect(framer.animate).not.toHaveBeenCalled();
  });

  it.each(["pointer", "touch"] as const)("shakes the element when the trigger becomes non-zero on %s", (policy) => {
    stubMotionMedia(policy);
    const { rerender } = render(<Shaker trigger={0} />);

    rerender(<Shaker trigger={1} />);
    expect(framer.animate).toHaveBeenCalledTimes(1);
    expect(framer.animate).toHaveBeenCalledWith(
      box(),
      { transform: shakeKeyframes },
      { duration: duration.slow, ease: ease.inOut },
    );
  });

  it("shakes again each time the trigger changes", () => {
    stubMotionMedia("pointer");
    const { rerender } = render(<Shaker trigger={1} />);
    rerender(<Shaker trigger={2} />);
    expect(framer.animate).toHaveBeenCalledTimes(2);
  });

  it("does not shake with reduced motion", () => {
    stubMotionMedia("reduced");
    render(<Shaker trigger={3} />);
    expect(framer.animate).not.toHaveBeenCalled();
  });

  it("does not shake while there is no element to shake", () => {
    stubMotionMedia("pointer");
    render(<Detached trigger={1} />);
    expect(framer.animate).not.toHaveBeenCalled();
  });

  it("clears the inline transform framer leaves behind once the shake ends", async () => {
    stubMotionMedia("pointer");
    framer.animate.mockImplementation((element: HTMLElement) => {
      element.style.transform = "translateX(3px)";
      return Promise.resolve();
    });
    render(<Shaker trigger={1} />);
    expect(box().style.transform).toBe("translateX(3px)");

    await act(() => Promise.resolve());
    expect(box().style.transform).toBe("");
  });
});
