"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useLandingMotionPolicy } from "./LandingMotion";

/** Shared Phase 2.0 CTA interaction, independent of entrance transforms. */
export function ActionMotion({ children }: { children: ReactNode }) {
  const policy = useLandingMotionPolicy();
  return <motion.div whileHover={policy === "desktop" ? { y: -3 } : undefined} transition={{ duration: 0.2 }}>{children}</motion.div>;
}
