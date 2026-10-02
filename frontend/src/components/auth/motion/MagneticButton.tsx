"use client";

import type { PointerEvent, ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { spring } from "./tokens";
import { useMotionPolicy } from "./useMotionPolicy";

const PULL = 0.2; // fraction of the cursor's distance from the center that the button follows
const MAX_PULL = 8; // px

const { stiffness, damping, mass } = spring.magnetic;

interface MagneticButtonProps {
  children: ReactNode;
  /** No pull and no press feedback while the button cannot be used. */
  disabled?: boolean;
}

/** Wraps a button so it leans toward the cursor and sinks slightly when pressed. Pointer devices only. */
export function MagneticButton({ children, disabled = false }: MagneticButtonProps) {
  const policy = useMotionPolicy();
  const active = policy === "pointer" && !disabled;

  const x = useSpring(useMotionValue(0), { stiffness, damping, mass });
  const y = useSpring(useMotionValue(0), { stiffness, damping, mass });

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!active) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    x.set(Math.max(-MAX_PULL, Math.min(MAX_PULL, dx * PULL)));
    y.set(Math.max(-MAX_PULL, Math.min(MAX_PULL, dy * PULL)));
  }

  function release() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      style={{ x, y }}
      whileTap={active ? { scale: 0.97 } : undefined}
      onPointerMove={handlePointerMove}
      onPointerLeave={release}
    >
      {children}
    </motion.div>
  );
}
