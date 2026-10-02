import type { Variants } from "framer-motion";
import { duration, ease } from "./tokens";

/** Parent variant: children using `hidden`/`visible` variants enter one after another. */
export function stagger(staggerChildren = 0.06, delayChildren = 0): Variants {
  return { hidden: {}, visible: { transition: { staggerChildren, delayChildren } } };
}

/**
 * The optional `custom` value is an entrance delay in seconds. It is left out of the transition
 * when absent, so a staggering parent keeps control of the timing.
 */
export const riseIn: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (delay?: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease: ease.outExpo, ...(delay ? { delay } : {}) },
  }),
};

/** Slides its content up from behind a parent that clips with `overflow: hidden`. */
export const maskReveal: Variants = {
  hidden: { y: "105%" },
  visible: { y: "0%", transition: { duration: duration.slow, ease: ease.outExpo } },
};

export const drawPath: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: { pathLength: 1, opacity: 1, transition: { duration: duration.slow * 2, ease: ease.inOut } },
};

/** Short horizontal shake; animate to `shake`, rest at `idle`. */
export const shake: Variants = {
  idle: { x: 0 },
  shake: { x: [0, -8, 8, -6, 6, -3, 3, 0], transition: { duration: duration.slow, ease: ease.inOut } },
};
