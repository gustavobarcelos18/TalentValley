"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { riseIn } from "./variants";

interface RevealProps {
  children: ReactNode;
  /** Seconds to wait before the entrance starts. */
  delay?: number;
  className?: string;
}

/** Entrance for a block that is already on screen when it mounts: fades and rises into place. */
export function Reveal({ children, delay = 0, className }: RevealProps) {
  return (
    <motion.div className={className} variants={riseIn} custom={delay} initial="hidden" animate="visible">
      {children}
    </motion.div>
  );
}
