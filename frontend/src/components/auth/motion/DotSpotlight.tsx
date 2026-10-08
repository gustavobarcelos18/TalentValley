"use client";

import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { motion, useMotionValue, useTransform } from "framer-motion";
import type { usePointerParallax } from "./usePointerParallax";

const TILE = 28;
const RADIUS = 170;

/**
 * Dot grid with a spotlight that follows the pointer: inside the spotlight the dots light up
 * and grow. The lit layer is the same grid with bigger, brighter dots, seen through a fixed
 * round mask. Only transforms move: the mask box follows the pointer and the grid inside it moves
 * the opposite way, so the lit dots stay exactly over the quiet ones.
 * Without a fine pointer the spotlight never appears and only the quiet grid remains.
 */
export function DotSpotlight({ pointer }: { pointer: ReturnType<typeof usePointerParallax> }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const width = useMotionValue(0);
  const height = useMotionValue(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => {
      width.set(root.clientWidth);
      height.set(root.clientHeight);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [width, height]);

  const maskX = useTransform([pointer.spotX, width], ([spot, size]: number[]) => spot * size - RADIUS);
  const maskY = useTransform([pointer.spotY, height], ([spot, size]: number[]) => spot * size - RADIUS);
  const gridX = useTransform(maskX, (value) => -value);
  const gridY = useTransform(maskY, (value) => -value);

  return (
    <Box ref={rootRef} aria-hidden="true" sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Box
        sx={(theme) => {
          const palette = (theme.vars ?? theme).palette;
          return {
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(circle, color-mix(in srgb, ${palette.text.secondary} 28%, transparent) 1px, transparent 1.6px)`,
            backgroundSize: `${TILE}px ${TILE}px`,
            ...theme.applyStyles("light", {
              backgroundImage: `radial-gradient(circle, color-mix(in srgb, ${palette.text.secondary} 22%, transparent) 1px, transparent 1.6px)`,
            }),
          };
        }}
      />
      <Box
        component={motion.div}
        style={{ x: maskX, y: maskY, opacity: pointer.presence }}
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: RADIUS * 2,
          height: RADIUS * 2,
          overflow: "hidden",
          willChange: "transform, opacity",
          maskImage: "radial-gradient(circle closest-side, #000 0%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(circle closest-side, #000 0%, transparent 100%)",
        }}
      >
        <Box
          component={motion.div}
          style={{ x: gridX, y: gridY, width, height }}
          sx={(theme) => {
            const palette = (theme.vars ?? theme).palette;
            return {
              position: "absolute",
              top: 0,
              left: 0,
              backgroundImage: `radial-gradient(circle, ${palette.primary.main} 2.2px, transparent 2.8px)`,
              backgroundSize: `${TILE}px ${TILE}px`,
            };
          }}
        />
      </Box>
    </Box>
  );
}
