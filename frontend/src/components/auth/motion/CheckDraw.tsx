"use client";

import { motion, useReducedMotion } from "framer-motion";
import { duration, ease } from "./tokens";

interface CheckDrawProps {
  /** Pixel size of the (square) icon. */
  size?: number;
  /** The check is drawn when true and wiped away when false. */
  drawn?: boolean;
  /** Draws the outline circle around the check. */
  circle?: boolean;
  strokeWidth?: number;
}

/** Check mark whose stroke draws itself (the circle, when shown, is always visible). Decorative. */
export function CheckDraw({ size = 16, drawn = true, circle = true, strokeWidth = 2 }: CheckDrawProps) {
  const reduced = useReducedMotion();
  const transition = reduced ? { duration: 0 } : { duration: duration.base, ease: ease.outExpo };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {circle && <circle cx="12" cy="12" r="10" />}
      <motion.path
        d="M7 12.5l3.2 3.2L17 8.8"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={drawn ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={transition}
      />
    </svg>
  );
}
