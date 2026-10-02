"use client";

import { Box } from "@mui/material";
import { motion } from "framer-motion";
import { CheckDraw } from "./CheckDraw";
import { duration, ease } from "./tokens";
import { useMotionPolicy } from "./useMotionPolicy";

const PARTICLE_COUNT = 10;
const RADIUS = 44;

const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
  return {
    x: Math.round(Math.cos(angle) * RADIUS),
    y: Math.round(Math.sin(angle) * RADIUS),
    size: i % 2 === 0 ? 6 : 4,
  };
});

/** Success badge: the check draws itself, then a few green specks drift out of it. Decorative. */
export function SuccessMark() {
  const policy = useMotionPolicy();
  const showParticles = policy === "pointer" || policy === "touch";

  return (
    <Box
      aria-hidden="true"
      sx={{
        position: "relative",
        alignSelf: "center",
        display: "grid",
        placeItems: "center",
        width: 72,
        height: 72,
        color: "success.main",
      }}
    >
      <CheckDraw size={64} strokeWidth={1.6} />
      {showParticles &&
        PARTICLES.map((particle, i) => (
          <motion.span
            key={i}
            style={{
              position: "absolute",
              width: particle.size,
              height: particle.size,
              borderRadius: "50%",
              backgroundColor: "currentColor",
            }}
            initial={{ opacity: 0, transform: "translate(0px, 0px) scale(0.4)" }}
            animate={{
              opacity: [0, 0.9, 0],
              transform: ["translate(0px, 0px) scale(0.4)", `translate(${particle.x}px, ${particle.y}px) scale(1)`],
            }}
            transition={{ duration: duration.slow * 1.5, delay: 0.35, ease: ease.outExpo }}
          />
        ))}
    </Box>
  );
}
