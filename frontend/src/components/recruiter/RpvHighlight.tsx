"use client";

import { Box, Chip } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import VerifiedOutlined from "@mui/icons-material/VerifiedOutlined";
import { motion } from "framer-motion";
import { ease } from "@/components/auth/motion/tokens";
import { useMotionPolicy } from "@/components/auth/motion/useMotionPolicy";
import { brandWash } from "@/components/common/surfaceGradient";

export const RPV_VERIFIED_LABEL = "Verificado pelo Rio Pomba Valley";

const SHINE_DELAY = 0.5;
const SHINE_DURATION = 1.1;

/**
 * Frame for the blocks of a student whose main formation is verified by the Rio Pomba Valley:
 * green border, soft glow and a light green wash. Only visual, it never changes search order or relevance.
 * `ring` is the width of the outer ring in px (a selected comparison card asks for a thicker one).
 */
export function rpvHighlightSx(theme: Theme, ring = 1) {
  const { primary } = (theme.vars ?? theme).palette;
  return {
    position: "relative",
    borderColor: primary.main,
    backgroundImage: brandWash(theme, 10),
    boxShadow: `0 0 0 ${ring}px ${primary.main}, 0 8px 24px color-mix(in srgb, ${primary.main} 22%, transparent)`,
  } as const;
}

/** Bigger "verified" badge, used instead of the small chip when the student is highlighted. */
export function RpvVerifiedBadge() {
  return (
    <Chip
      icon={<VerifiedOutlined />}
      color="success"
      label={RPV_VERIFIED_LABEL}
      sx={{ alignSelf: "flex-start", fontWeight: 700, border: 1, borderColor: "success.main" }}
    />
  );
}

/**
 * One light sweep across the block when it appears. Place it as a child of an element framed by
 * `rpvHighlightSx`. With "reduce motion" (or before hydration) it renders nothing.
 */
export function RpvShine() {
  const policy = useMotionPolicy();
  if (policy === "pending" || policy === "reduced") return null;

  return (
    <Box aria-hidden="true" data-testid="rpv-shine" sx={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: "inherit", pointerEvents: "none" }}>
      <motion.span
        initial={{ x: "-120%" }}
        animate={{ x: "420%" }}
        transition={{ duration: SHINE_DURATION, delay: SHINE_DELAY, ease: ease.inOut }}
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "40%",
          background: "linear-gradient(100deg, transparent, color-mix(in srgb, var(--mui-palette-primary-main) 30%, transparent), transparent)",
        }}
      />
    </Box>
  );
}
