"use client";

import { Box } from "@mui/material";
import { motion, useTransform } from "framer-motion";
import type { usePointerParallax } from "./motion/usePointerParallax";

// How far each depth layer travels (SVG units) when the pointer crosses the whole screen.
const FAR = 24;
const MID = 44;
const NEAR = 76;
// The mountain group is drawn at 7.7x; its layers move in that scaled space.
const MARK_SCALE = 7.7;

/**
 * Decorative terrain behind the entry screens. Colors come from the MUI theme. The layers shift
 * with the pointer at different depths; without a pointer they stay still.
 */
export function LoginVisualScene({ pointer }: { pointer: ReturnType<typeof usePointerParallax> }) {
  const farX = useTransform(pointer.x, (value) => value * FAR);
  const farY = useTransform(pointer.y, (value) => value * FAR);
  const midX = useTransform(pointer.x, (value) => (value * MID) / MARK_SCALE);
  const midY = useTransform(pointer.y, (value) => (value * MID) / MARK_SCALE);
  const nearX = useTransform(pointer.x, (value) => (value * NEAR) / MARK_SCALE);
  const nearY = useTransform(pointer.y, (value) => (value * NEAR) / MARK_SCALE);

  return (
    <Box
      aria-hidden="true"
      sx={(theme) => {
        const palette = (theme.vars ?? theme).palette;
        return {
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          "& > svg": { width: "100%", height: "100%" },
          "& .tv-scene__contours": {
            stroke: palette.secondary.main,
            strokeWidth: 0.8,
            opacity: 0.16,
            ...theme.applyStyles("light", { opacity: 0.12 }),
          },
          "& .tv-scene__mountain": theme.applyStyles("light", { opacity: 0.85 }),
          "& .tv-scene__facets": {
            stroke: palette.primary.main,
            strokeOpacity: 0.38,
          },
          "& .tv-scene__network": {
            stroke: palette.secondary.main,
            opacity: 0.42,
          },
          "& .tv-scene__nodes": { fill: palette.primary.main },
        };
      }}
    >
      <svg viewBox="0 0 760 620" fill="none" focusable="false" preserveAspectRatio="xMidYMax meet">
        <motion.g className="tv-scene__contours" style={{ x: farX, y: farY }}>
          <path d="M-80 360C70 290 110 420 270 390S470 310 610 370 770 360 850 310" />
          <path d="M-80 402C70 332 120 462 280 432S470 352 620 412 770 402 850 352" />
          <path d="M-80 444C80 374 130 504 290 474S480 394 630 454 780 444 850 394" />
          <path d="M-80 486C90 416 140 546 300 516S490 436 640 496 790 486 850 436" />
          <path d="M-80 528C100 458 150 588 310 558S500 478 650 538 800 528 850 478" />
          <path d="M-80 570C110 500 160 630 320 600S510 520 660 580 810 570 850 520" />
        </motion.g>

        {/* Exact silhouette, polygon divisions and river from TalentValleyMark.
            Only scale, stroke weight and the theme palette differ. Keep these
            paths in sync with components/brand/TalentValleyMark.tsx. */}
        <g transform="translate(-14 80) scale(7.7)">
          <motion.g className="tv-scene__mountain" style={{ x: midX, y: midY }}>
            <path d="M2 46 49 4 66 21 77 14 100 46Z" fill="#008F73" fillOpacity=".18" />
            <path d="m2 46 24-22 12 17Z" fill="#00B838" fillOpacity=".16" />
            <path d="m24 24 25-20-11 37Z" fill="#A0D060" fillOpacity=".52" />
            <path d="m49 4 17 17-28 20Z" fill="#00B838" fillOpacity=".12" />
            <path d="m49 4 7 25 10-8Z" fill="#A0D060" fillOpacity=".66" />
            <path d="m56 29 10-8 11 17-20 8Z" fill="#20C8C0" fillOpacity=".3" />
            <path d="m66 21 11-7 8 15Z" fill="#008F73" fillOpacity=".28" />
            <path d="m77 38 8-9 15 17H57Z" fill="#A0D060" fillOpacity=".24" />
            <path
              className="tv-scene__facets"
              d="M2 46 49 4 66 21 77 14 100 46ZM24 24l32 5 21 9M49 4l7 25-18 12L24 24M56 29l10-8 19 8-8 9 23 8M38 41l-36 5m36-5 18-12"
              strokeWidth=".12"
            />
          </motion.g>
          <motion.g className="tv-scene__network" strokeWidth=".14" style={{ x: nearX, y: nearY }}>
            <path d="M24 24 56 29 77 38M56 29q15 7 1 17" />
            <path d="M24 24 15 54 57 46 82 59 77 38" />
          </motion.g>
          <motion.g className="tv-scene__nodes" style={{ x: nearX, y: nearY }}>
            <circle cx="24" cy="24" r=".6" />
            <circle cx="56" cy="29" r=".85" />
            <circle cx="77" cy="38" r=".6" />
            <circle cx="15" cy="54" r=".4" />
            <circle cx="82" cy="59" r=".4" />
          </motion.g>
        </g>
      </svg>
    </Box>
  );
}
