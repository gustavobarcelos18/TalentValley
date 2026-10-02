"use client";

import { useMemo } from "react";
import { Box } from "@mui/material";
import { motion } from "framer-motion";
import { useAmbient, useLoop } from "./AmbientMotion";
import { duration, ease } from "./tokens";
import { drawPath, stagger } from "./variants";

// Abstract talent network on a 1000x1000 canvas stretched over the screen: nodes pulse out of
// phase, and a pulse of light travels along some of the links. Decorative only.
// Links are drawn once in an SVG. Nodes and pulses are separate HTML elements positioned in
// percent, so their loops animate transform/opacity on their own compositor layers and never
// repaint the rest.
const NODES: { x: number; y: number; r: number }[] = [
  { x: 120, y: 160, r: 5 },
  { x: 330, y: 90, r: 4 },
  { x: 560, y: 190, r: 6 },
  { x: 820, y: 120, r: 4 },
  { x: 900, y: 360, r: 5 },
  { x: 700, y: 470, r: 4 },
  { x: 430, y: 400, r: 6 },
  { x: 160, y: 460, r: 4 },
  { x: 300, y: 700, r: 5 },
  { x: 620, y: 760, r: 4 },
  { x: 880, y: 800, r: 5 },
];

const LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [5, 6], [0, 7], [7, 6], [7, 8], [6, 9], [8, 9], [9, 10], [5, 10],
];

// Links that carry a traveling pulse (index into LINKS), each with its own start offset in seconds.
const PULSES: { link: number; delay: number }[] = [
  { link: 1, delay: 0 },
  { link: 5, delay: 1.4 },
  { link: 8, delay: 2.6 },
  { link: 11, delay: 0.8 },
  { link: 12, delay: 3.4 },
];

// One trip lasts about 2.4 s; the rest of the period is the pause before the next one.
const PULSE_PERIOD = 6.6;

const PULSE_KEYFRAMES = { transform: ["scale(1)", "scale(1.8)", "scale(1)"], opacity: [0.7, 1, 0.7] };

const percent = (value: number) => `${value / 10}%`;

function PulseNode({ x, y, r, index }: { x: number; y: number; r: number; index: number }) {
  // Different periods and offsets keep the nodes out of phase.
  const options = useMemo(() => ({ duration: 3 + (index % 4) * 0.5, delay: (index * 0.7) % 3, ease: ease.inOut }), [index]);
  const scope = useLoop<HTMLSpanElement>(PULSE_KEYFRAMES, options);

  // The outer element carries the resting tone (CSS opacity, theme dependent); the inner one pulses
  // on top of it, so the loop multiplies with that tone instead of replacing it.
  return (
    <Box
      component="span"
      className="tv-net__node"
      sx={{
        position: "absolute",
        left: percent(x),
        top: percent(y),
        width: r * 2,
        height: r * 2,
        ml: `${-r}px`,
        mt: `${-r}px`,
      }}
    >
      <Box
        ref={scope}
        component="span"
        sx={{ display: "block", width: "100%", height: "100%", borderRadius: "50%", willChange: "transform, opacity" }}
      />
    </Box>
  );
}

function TravelingPulse({ link, delay }: { link: number; delay: number }) {
  const [from, to] = LINKS[link].map((index) => NODES[index]);
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  // The track is a box as big as the link. Moving it by 100% of its own size, toward the end node,
  // moves the dot (stuck to the start corner) from one node to the other without measuring anything.
  const end = "translate(" + (dx >= 0 ? "100%" : "-100%") + ", " + (dy >= 0 ? "100%" : "-100%") + ")";
  // The pause between two trips is part of the keyframes (instead of `repeatDelay`), so the whole
  // loop stays one native animation on the compositor.
  const keyframes = useMemo(
    () => ({
      transform: ["translate(0, 0)", "translate(0, 0)", end, end, end],
      opacity: [0, 1, 1, 0, 0],
    }),
    [end],
  );
  const options = useMemo(
    () => ({ duration: PULSE_PERIOD, delay, ease: "linear" as const, times: [0, 0.015, 0.36, 0.39, 1] }),
    [delay],
  );
  const scope = useLoop<HTMLSpanElement>(keyframes, options);

  return (
    <Box
      ref={scope}
      component="span"
      sx={{
        position: "absolute",
        left: percent(Math.min(from.x, to.x)),
        top: percent(Math.min(from.y, to.y)),
        width: percent(Math.abs(dx)),
        height: percent(Math.abs(dy)),
        willChange: "transform, opacity",
        opacity: 0,
      }}
    >
      <Box
        component="span"
        className="tv-net__pulse"
        sx={{
          position: "absolute",
          width: 8,
          height: 8,
          borderRadius: "50%",
          ...(dx >= 0 ? { left: -4 } : { right: -4 }),
          ...(dy >= 0 ? { top: -4 } : { bottom: -4 }),
        }}
      />
    </Box>
  );
}

/** Decorative network behind the entry screens. */
export function TalentNetwork() {
  const { enabled } = useAmbient();

  return (
    <Box
      aria-hidden="true"
      sx={(theme) => {
        const palette = (theme.vars ?? theme).palette;
        return {
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          "& svg": { width: "100%", height: "100%" },
          "& .tv-net__link": { stroke: palette.secondary.main, strokeWidth: 1.2, strokeOpacity: 0.28, fill: "none" },
          "& .tv-net__node > span, & .tv-net__pulse": { bgcolor: palette.primary.main },
          "& .tv-net__node": { opacity: 0.7 },
          "& .tv-net__pulse": { opacity: 0.9 },
          ...theme.applyStyles("light", {
            "& .tv-net__link": { strokeOpacity: 0.22 },
            "& .tv-net__node": { opacity: 0.55 },
          }),
        };
      }}
    >
      <motion.div
        style={{ position: "absolute", inset: 0 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: duration.slow, delay: enabled ? 0.4 : 0, ease: ease.outExpo }}
      >
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" focusable="false">
          {/* Remounts when the loops switch on, so the links draw in only when motion is allowed. */}
          <motion.g
            key={enabled ? "live" : "static"}
            variants={stagger(0.08, 0.6)}
            initial={enabled ? "hidden" : false}
            animate="visible"
          >
            {LINKS.map(([a, b], index) => (
              <motion.path
                key={index}
                className="tv-net__link"
                variants={drawPath}
                d={`M${NODES[a].x} ${NODES[a].y}L${NODES[b].x} ${NODES[b].y}`}
              />
            ))}
          </motion.g>
        </svg>

        {NODES.map((node, index) => (
          <PulseNode key={index} {...node} index={index} />
        ))}

        {PULSES.map((pulse) => (
          <TravelingPulse key={pulse.link} {...pulse} />
        ))}
      </motion.div>
    </Box>
  );
}
