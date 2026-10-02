"use client";

import { Box } from "@mui/material";
import type { DOMKeyframesDefinition } from "framer-motion";
import { useLoop } from "./AmbientMotion";
import { ease } from "./tokens";

type AuroraColor = "primary" | "secondary";

interface Blob {
  color: AuroraColor;
  size: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  drift: DOMKeyframesDefinition;
  seconds: number;
}

// One transform string per step ([x %, y %, scale]): a single transform keyframe track runs on the
// compositor, while separate x/y/scale values would be animated on the main thread.
function drift(steps: [number, number, number][]): DOMKeyframesDefinition {
  return { transform: steps.map(([x, y, scale]) => `translate(${x}%, ${y}%) scale(${scale})`) };
}

// Three soft color blobs drifting slowly (20-30 s per loop) in different directions.
const BLOBS: Blob[] = [
  {
    color: "primary",
    size: "75%",
    position: { top: "-25%", left: "-20%" },
    drift: drift([[0, 0, 1], [16, 10, 1.15], [-6, 22, 0.95], [0, 0, 1]]),
    seconds: 26,
  },
  {
    color: "secondary",
    size: "65%",
    position: { bottom: "-25%", right: "-20%" },
    drift: drift([[0, 0, 1], [-14, -12, 0.9], [6, -4, 1.12], [0, 0, 1]]),
    seconds: 22,
  },
  {
    color: "primary",
    size: "45%",
    position: { top: "35%", right: "-10%" },
    drift: drift([[0, 0, 1], [-18, 14, 1.2], [10, -14, 0.9], [0, 0, 1]]),
    seconds: 30,
  },
];

function AuroraBlob({ blob }: { blob: Blob }) {
  const scope = useLoop<HTMLDivElement>(blob.drift, { duration: blob.seconds, ease: ease.inOut });

  return (
    <Box
      ref={scope}
      sx={(theme) => {
        const color = (theme.vars ?? theme).palette[blob.color].main;
        return {
          position: "absolute",
          width: blob.size,
          aspectRatio: "1",
          ...blob.position,
          borderRadius: "50%",
          // The glow is a static gradient; only the transform of the layer moves.
          background: `radial-gradient(closest-side, color-mix(in srgb, ${color} 24%, transparent), transparent)`,
          willChange: "transform",
          ...theme.applyStyles("light", {
            background: `radial-gradient(closest-side, color-mix(in srgb, ${color} 14%, transparent), transparent)`,
          }),
        };
      }}
    />
  );
}

/** Decorative drifting aurora behind the entry screens. */
export function AuroraBackground() {
  return (
    <Box aria-hidden="true" sx={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      {BLOBS.map((blob, index) => (
        <AuroraBlob key={index} blob={blob} />
      ))}
    </Box>
  );
}
