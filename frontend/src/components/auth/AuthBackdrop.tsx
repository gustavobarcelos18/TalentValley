"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Box } from "@mui/material";
import { motion, useAnimate, useInView } from "framer-motion";
import { TalentValleyMark } from "@/components/brand/TalentValleyMark";
import { LoginVisualScene } from "./LoginVisualScene";
import { AmbientMotion } from "./motion/AmbientMotion";
import { AuroraBackground } from "./motion/AuroraBackground";
import { DotSpotlight } from "./motion/DotSpotlight";
import { TalentNetwork } from "./motion/TalentNetwork";
import { duration, ease } from "./motion/tokens";
import { useMotionPolicy } from "./motion/useMotionPolicy";
import { usePageVisible } from "./motion/usePageVisible";
import { usePointerParallax } from "./motion/usePointerParallax";
import { maskReveal, riseIn, stagger } from "./motion/variants";

const MD = "@media (min-width: 768px)";

// Brand lockup look, driven by the theme (the markup is in BrandLockup below).
const brandSx = {
  "& .tv-brand": { display: "flex", alignItems: "center", gap: "6px", [MD]: { gap: "10px" } },
  "& .tv-brand svg": {
    flexShrink: 0,
    height: "auto",
    width: 38,
    [MD]: { width: 65 },
    "@media (min-width: 1351px)": { width: 102 },
  },
  "& .tv-brand strong": {
    display: "block",
    fontFamily: "Georgia, serif",
    fontWeight: 600,
    letterSpacing: "-0.055em",
    lineHeight: 1.1,
    fontSize: "1.25rem",
    [MD]: { fontSize: "1.5rem" },
    "@media (min-width: 1351px)": { fontSize: "2rem" },
  },
  "& .tv-brand em": { color: "secondary.main", fontStyle: "normal" },
  "& .tv-brand small": {
    display: "block",
    mt: "5px",
    color: "text.secondary",
    fontSize: "0.53rem",
    letterSpacing: "0.015em",
    [MD]: { fontSize: "0.8rem" },
  },
} as const;

// Same lockup as landing/Brand, split in parts so each one can enter on its own:
// the mark draws its outline, the wordmark slides up from behind a clip, the tagline rises.
function BrandLockup({ entrance }: { entrance: boolean }) {
  const [scope, animate] = useAnimate<HTMLSpanElement>();
  const policy = useMotionPolicy();
  const draw = entrance && (policy === "touch" || policy === "pointer");

  useEffect(() => {
    const mark = scope.current;
    if (!draw || !mark) return;
    const outlines = Array.from(mark.querySelectorAll("path[stroke]"));
    const controls = animate(outlines, { pathLength: [0, 1] }, { duration: 1.1, delay: 0.15, ease: ease.inOut });
    return () => controls.cancel();
  }, [draw, scope, animate]);

  return (
    <span className="tv-brand">
      <motion.span
        ref={scope}
        style={{ display: "flex" }}
        initial={entrance ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        transition={{ duration: duration.slow, ease: ease.outExpo }}
      >
        <TalentValleyMark />
      </motion.span>

      <motion.span variants={stagger(0.2, 0.3)} initial={entrance ? "hidden" : false} animate="visible">
        {/* The padding keeps descenders inside the clip; the negative margin cancels its height. */}
        <span style={{ display: "block", overflow: "hidden", paddingBottom: "0.12em", marginBottom: "-0.12em" }}>
          <motion.strong variants={maskReveal}>
            Talent <em>Valley</em>
          </motion.strong>
        </span>
        <motion.small variants={riseIn}>by Rio Pomba Valley</motion.small>
      </motion.span>
    </span>
  );
}

// Full-screen animated backdrop of the entry screens, with the form card floating over it.
// The brand entrance plays only when `entrance` is set, so server-rendered pages keep the brand visible.
// Pointer effects listen on the whole screen, so they keep working while the pointer is over the card.
export function AuthBackdrop({ entrance, children }: { entrance: boolean; children: ReactNode }) {
  const rootRef = useRef<HTMLElement | null>(null);
  const pointer = usePointerParallax(rootRef);
  const visible = usePageVisible();
  const inView = useInView(rootRef);

  return (
    <Box
      component="main"
      ref={rootRef}
      sx={{
        position: "relative",
        isolation: "isolate",
        minHeight: "100svh",
        overflow: "clip",
        bgcolor: "background.default",
        color: "text.primary",
      }}
    >
      <AmbientMotion active={visible && inView}>
        <AuroraBackground />
        <DotSpotlight pointer={pointer} />
        <LoginVisualScene pointer={pointer} />
        <TalentNetwork />

        <Box sx={{ position: "absolute", zIndex: 1, top: 24, left: 24, [MD]: { top: 40, left: 48 }, ...brandSx }}>
          <BrandLockup entrance={entrance} />
        </Box>

        <Box
          sx={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100svh",
            px: 2,
            "@media (max-width: 399px)": { px: 1 },
            pt: 14,
            pb: 6,
          }}
        >
          {children}
        </Box>
      </AmbientMotion>
    </Box>
  );
}
