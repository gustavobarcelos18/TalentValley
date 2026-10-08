import type { BezierDefinition } from "framer-motion";

// Motion tokens shared by every entry-screen animation.
export const duration = { fast: 0.15, base: 0.3, slow: 0.6 } as const;

export const ease: Record<"outExpo" | "inOut", BezierDefinition> = {
  outExpo: [0.16, 1, 0.3, 1],
  inOut: [0.42, 0, 0.58, 1],
};

export const spring = {
  soft: { type: "spring", stiffness: 120, damping: 20, mass: 0.8 },
  snappy: { type: "spring", stiffness: 400, damping: 30 },
  magnetic: { type: "spring", stiffness: 150, damping: 15, mass: 0.1 },
} as const;
