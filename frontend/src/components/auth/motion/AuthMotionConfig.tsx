"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "framer-motion";

/** Honors `prefers-reduced-motion` for every declarative animation below it: transforms are skipped, fades stay. */
export function AuthMotionConfig({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
