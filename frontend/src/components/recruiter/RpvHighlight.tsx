"use client";

import { Box, Chip } from "@mui/material";
import type { Theme } from "@mui/material/styles";
import VerifiedOutlined from "@mui/icons-material/VerifiedOutlined";
import { motion } from "framer-motion";
import { ease } from "@/components/auth/motion/tokens";
import { useMotionPolicy } from "@/components/auth/motion/useMotionPolicy";

export const RPV_VERIFIED_LABEL = "Verificado pelo Rio Pomba Valley";

const SHINE_DELAY = 0.5;
const SHINE_REPEAT_DELAY = 2.5;
const SHINE_DURATION = 1.1;

/**
 * Frame for the blocks of a student with any formation verified by the Rio Pomba Valley:
 * neon green border and a soft glow. Only visual, it never changes search order or relevance.
 * `ring` is the width of the outer ring in px (a selected comparison card asks for a thicker one).
 */
export function rpvHighlightSx(theme: Theme, ring = 1) {
  const { primary } = (theme.vars ?? theme).palette;
  return {
    position: "relative",
    borderColor: primary.main,
    backgroundImage: "none",
    boxShadow: `0 0 0 ${ring}px ${primary.main}, 0 0 12px color-mix(in srgb, ${primary.main} 55%, transparent), 0 0 28px color-mix(in srgb, ${primary.main} 22%, transparent), inset 0 0 14px color-mix(in srgb, ${primary.main} 14%, transparent)`,
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
 * A light sweep that crosses the block horizontally, repeating with a pause between passes. Place it as a child of an element framed by
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
        transition={{ duration: SHINE_DURATION, delay: SHINE_DELAY, ease: ease.inOut, repeat: Infinity, repeatDelay: SHINE_REPEAT_DELAY }}
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

/** A student is highlighted when any formation is from the Rio Pomba Valley and its validation is verified. */
export function hasVerifiedFormation(
  formations: ReadonlyArray<{ ehRioPombaValley: boolean; statusValidacaoRpv: string | null }>,
) {
  return formations.some((formation) => formation.ehRioPombaValley && formation.statusValidacaoRpv === "VERIFICADO");
}
