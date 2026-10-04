import { describe, expect, it } from "vitest";
import { duration, ease, spring } from "@/components/auth/motion/tokens";

describe("motion tokens", () => {
  it("orders the durations from fast to slow", () => {
    expect(duration).toEqual({ fast: 0.15, base: 0.3, slow: 0.6 });
  });

  it("defines the easing curves as cubic beziers", () => {
    expect(ease.outExpo).toEqual([0.16, 1, 0.3, 1]);
    expect(ease.inOut).toEqual([0.42, 0, 0.58, 1]);
  });

  it("defines three spring presets", () => {
    expect(spring.soft).toEqual({ type: "spring", stiffness: 120, damping: 20, mass: 0.8 });
    expect(spring.snappy).toEqual({ type: "spring", stiffness: 400, damping: 30 });
    expect(spring.magnetic).toEqual({ type: "spring", stiffness: 150, damping: 15, mass: 0.1 });
  });
});
