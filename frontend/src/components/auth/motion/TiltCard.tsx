"use client";

import type { PointerEvent, ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { spring } from "./tokens";
import { useMotionPolicy } from "./useMotionPolicy";

const MAX_TILT = 5; // degrees

interface TiltCardProps {
  children: ReactNode;
}

/**
 * Leans toward the cursor while it hovers, and publishes where the cursor is as `--glow-x` and
 * `--glow-y` (percent), so a child can draw a light that follows it. Mouse only: touch, keyboard
 * and reduced motion get the plain card.
 */
export function TiltCard({ children }: TiltCardProps) {
  const active = useMotionPolicy() === "pointer";

  const rotateX = useSpring(useMotionValue(0), spring.soft);
  const rotateY = useSpring(useMotionValue(0), spring.soft);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!active || event.pointerType !== "mouse") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 2 * MAX_TILT);
    rotateX.set((0.5 - py) * 2 * MAX_TILT);
    event.currentTarget.style.setProperty("--glow-x", `${px * 100}%`);
    event.currentTarget.style.setProperty("--glow-y", `${py * 100}%`);
  }

  function release() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={release}
    >
      {children}
    </motion.div>
  );
}
