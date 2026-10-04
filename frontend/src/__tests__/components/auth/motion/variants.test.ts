import type { TargetAndTransition, Transition } from "framer-motion";
import { describe, expect, it } from "vitest";
import { duration, ease } from "@/components/auth/motion/tokens";
import { drawPath, maskReveal, riseIn, shakeKeyframes, stagger } from "@/components/auth/motion/variants";

function riseInVisible(delay?: number) {
  const visible = riseIn.visible as (custom?: number) => TargetAndTransition;
  return visible(delay);
}

function transitionOf(variant: unknown) {
  return (variant as TargetAndTransition).transition as Transition;
}

describe("stagger", () => {
  it("staggers children by 0.06s with no initial delay by default", () => {
    expect(stagger()).toEqual({ hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0 } } });
  });

  it("uses the given stagger and delay", () => {
    expect(stagger(0.1, 0.5).visible).toEqual({ transition: { staggerChildren: 0.1, delayChildren: 0.5 } });
  });
});

describe("riseIn", () => {
  it("starts hidden, shifted down", () => {
    expect(riseIn.hidden).toEqual({ opacity: 0, y: 16 });
  });

  it("leaves the delay out of the transition when none is given", () => {
    const visible = riseInVisible();
    expect(visible).toMatchObject({ opacity: 1, y: 0 });
    expect(visible.transition).toEqual({ duration: duration.slow, ease: ease.outExpo });
  });

  it("treats a zero delay as no delay", () => {
    expect(riseInVisible(0).transition).toEqual({ duration: duration.slow, ease: ease.outExpo });
  });

  it("adds the custom delay to the transition", () => {
    expect(riseInVisible(0.4).transition).toEqual({ duration: duration.slow, ease: ease.outExpo, delay: 0.4 });
  });
});

describe("maskReveal", () => {
  it("slides from below the clipping parent to rest", () => {
    expect(maskReveal.hidden).toEqual({ y: "105%" });
    expect(maskReveal.visible).toMatchObject({ y: "0%" });
    expect(transitionOf(maskReveal.visible)).toEqual({ duration: duration.slow, ease: ease.outExpo });
  });
});

describe("drawPath", () => {
  it("draws the path from nothing to its full length over twice the slow duration", () => {
    expect(drawPath.hidden).toEqual({ pathLength: 0, opacity: 0 });
    expect(drawPath.visible).toMatchObject({ pathLength: 1, opacity: 1 });
    expect(transitionOf(drawPath.visible)).toEqual({ duration: duration.slow * 2, ease: ease.inOut });
  });
});

describe("shakeKeyframes", () => {
  it("is a decaying left-right translateX sequence that ends at rest", () => {
    expect(shakeKeyframes).toEqual([
      "translateX(0px)",
      "translateX(-8px)",
      "translateX(8px)",
      "translateX(-6px)",
      "translateX(6px)",
      "translateX(-3px)",
      "translateX(3px)",
      "translateX(0px)",
    ]);
  });
});
