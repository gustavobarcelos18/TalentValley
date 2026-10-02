"use client";

import type { CSSProperties, ReactNode } from "react";
import { Box } from "@mui/material";
import type { AnimationOptions, DOMKeyframesDefinition } from "framer-motion";
import { useLoop } from "./motion/AmbientMotion";
import { ease } from "./motion/tokens";

export type SystemSceneKind = "lost" | "locked" | "failed";

// Small illustrations for the system states, in the language of the talent network behind the
// screen: nodes and links. Decorative (aria-hidden); the message next to it says the same in text.
// Every loop animates only transform/opacity and goes through useLoop, so with reduced motion (or
// before hydration) the scene is a still image of the state, which is what the base styles draw.

const WIDTH = 180;
const HEIGHT = 110;

// Absolutely positioned box centered on a point of the scene.
const centered = (x: number, y: number, size: number): CSSProperties => ({
  position: "absolute",
  left: x - size / 2,
  top: y - size / 2,
  width: size,
  height: size,
});

function Loop({
  keyframes,
  options,
  sx,
  style,
  children,
}: {
  keyframes: DOMKeyframesDefinition;
  options: AnimationOptions;
  sx?: object;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const scope = useLoop<HTMLSpanElement>(keyframes, options);
  return (
    <Box
      ref={scope}
      component="span"
      sx={{ display: "block", willChange: "transform, opacity", ...sx }}
      style={style}
    >
      {children}
    </Box>
  );
}

const Dot = ({ x, y, size = 10, className = "sc-node" }: { x: number; y: number; size?: number; className?: string }) => (
  <Box component="span" className={className} sx={{ borderRadius: "50%" }} style={centered(x, y, size)} />
);

const Line = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => (
  <line className="sc-link" x1={x1} y1={y1} x2={x2} y2={y2} />
);

// 404: the network is fine, one node drifted away and is looking for a connection.
const LOST_FLOAT = { transform: ["translateY(0px)", "translateY(-6px)", "translateY(0px)"] };
const LOST_FLOAT_OPTIONS = { duration: 4, ease: ease.inOut };
const LOST_RING = { transform: ["scale(1)", "scale(3)"], opacity: [0.55, 0] };
const LOST_RING_OPTIONS = { duration: 2.4, ease: ease.outExpo };
const LOST_SWEEP = { transform: ["rotate(0deg)", "rotate(360deg)"] };
const LOST_SWEEP_OPTIONS = { duration: 3.2, ease: "linear" as const };

function LostScene() {
  return (
    <>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} focusable="false">
        <Line x1={28} y1={72} x2={62} y2={42} />
        <Line x1={62} y1={42} x2={100} y2={68} />
        <Line x1={100} y1={68} x2={70} y2={94} />
        <Line x1={70} y1={94} x2={28} y2={72} />
        <Line x1={62} y1={42} x2={70} y2={94} />
        {/* Open end: the link that reaches out and finds nothing. */}
        <line className="sc-link" x1={100} y1={68} x2={124} y2={50} strokeDasharray="3 4" />
      </svg>
      <Dot x={28} y={72} />
      <Dot x={62} y={42} size={12} />
      <Dot x={100} y={68} />
      <Dot x={70} y={94} />

      <Loop keyframes={LOST_FLOAT} options={LOST_FLOAT_OPTIONS} style={centered(150, 32, 12)}>
        <Loop
          keyframes={LOST_RING}
          options={LOST_RING_OPTIONS}
          sx={{ position: "absolute", inset: 0, borderRadius: "50%", border: 1, borderColor: "primary.main", opacity: 0 }}
        />
        {/* Search arm: a line that turns around the lost node. */}
        <Loop
          keyframes={LOST_SWEEP}
          options={LOST_SWEEP_OPTIONS}
          sx={{ position: "absolute", left: 6, top: 5, width: 26, height: 2, transformOrigin: "0 50%", opacity: 0.5 }}
        >
          <Box component="span" className="sc-arm" sx={{ display: "block", height: "100%", borderRadius: 1 }} />
        </Loop>
        <Box component="span" className="sc-node" sx={{ position: "absolute", inset: 0, borderRadius: "50%" }} />
      </Loop>
    </>
  );
}

// 403: a padlock hangs from the network and swings a few times, then rests.
const SWING = { transform: ["rotate(0deg)", "rotate(-9deg)", "rotate(7deg)", "rotate(-4deg)", "rotate(2deg)", "rotate(0deg)", "rotate(0deg)"] };
const SWING_OPTIONS = { duration: 5, ease: ease.inOut, times: [0, 0.1, 0.2, 0.3, 0.38, 0.46, 1] };

function LockedScene() {
  return (
    <>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} focusable="false">
        <Line x1={90} y1={10} x2={36} y2={26} />
        <Line x1={90} y1={10} x2={144} y2={26} />
        <Line x1={36} y1={26} x2={14} y2={58} />
        <Line x1={144} y1={26} x2={166} y2={58} />
      </svg>
      <Dot x={36} y={26} size={8} />
      <Dot x={144} y={26} size={8} />
      <Dot x={14} y={58} size={6} />
      <Dot x={166} y={58} size={6} />
      <Dot x={90} y={10} size={10} />

      {/* Pivot at the top node: the line and the lock swing together. */}
      <Loop
        keyframes={SWING}
        options={SWING_OPTIONS}
        sx={{ position: "absolute", left: 90 - 22, top: 10, width: 44, transformOrigin: "50% 0" }}
      >
        <Box component="span" className="sc-link-solid" sx={{ display: "block", width: 2, height: 16, mx: "auto" }} />
        <Box
          component="span"
          className="sc-lock"
          sx={{ display: "block", width: 24, height: 20, mx: "auto", borderWidth: 4, borderStyle: "solid", borderBottom: 0, borderRadius: "12px 12px 0 0" }}
        />
        <Box component="span" className="sc-lock-body" sx={{ display: "block", position: "relative", width: 44, height: 32, borderRadius: 1.5 }}>
          <Box
            component="span"
            sx={{ position: "absolute", left: "50%", top: 9, width: 8, height: 8, ml: "-4px", borderRadius: "50%", bgcolor: "background.paper" }}
          />
          <Box
            component="span"
            sx={{ position: "absolute", left: "50%", top: 15, width: 3, height: 9, ml: "-1.5px", borderRadius: 1, bgcolor: "background.paper" }}
          />
        </Box>
      </Loop>
    </>
  );
}

// Error: the middle node fails (flickers, goes red, the link to its right drops) and then the
// connection comes back. The base styles draw the failed state; the loop plays it and recovers.
// All the layers share the same period and `times`, so they stay in step.
const STEP = { duration: 6, ease: "linear" as const };
// Healthy until 35% of the period, failing from 37% to 70%, back at 74%.
const STEP_OPTIONS = { ...STEP, times: [0, 0.35, 0.37, 0.7, 0.74, 1] };

const OK_NODE = { opacity: [1, 1, 0, 0, 1, 1] };
const LINK_OK = { opacity: [0.45, 0.45, 0, 0, 0.45, 0.45] };
const LINK_BROKEN = { opacity: [0, 0, 1, 1, 0, 0] };
const FAIL_FLICKER = { opacity: [0, 0, 1, 0.35, 1, 0.5, 1, 1, 0, 0] };
const FAIL_FLICKER_OPTIONS = { ...STEP, times: [0, 0.35, 0.37, 0.41, 0.45, 0.49, 0.53, 0.7, 0.74, 1] };
const RECONNECT = { transform: ["scale(1)", "scale(1)", "scale(1)", "scale(3)", "scale(3)"], opacity: [0, 0, 0.7, 0, 0] };
const RECONNECT_OPTIONS = { ...STEP, times: [0, 0.7, 0.72, 0.88, 1] };

function FailedScene() {
  const row = 55;
  return (
    <>
      {/* L - M link is always up; M - R is up, drops, and comes back. */}
      <Box component="span" className="sc-link-solid" sx={{ position: "absolute", opacity: 0.45 }} style={{ left: 30, top: row - 1, width: 60, height: 2 }} />
      <Loop
        keyframes={LINK_OK}
        options={STEP_OPTIONS}
        sx={{ position: "absolute", left: 90, top: row - 1, width: 60, height: 2, bgcolor: "secondary.main", opacity: 0 }}
      />
      <Loop
        keyframes={LINK_BROKEN}
        options={STEP_OPTIONS}
        sx={{ position: "absolute", left: 90, top: row - 1, width: 60, height: 2 }}
      >
        <Box component="span" className="sc-broken" sx={{ position: "absolute", left: 8, width: 14, borderTop: "2px dashed" }} />
        <Box component="span" className="sc-broken" sx={{ position: "absolute", right: 8, width: 14, borderTop: "2px dashed" }} />
      </Loop>

      <Dot x={30} y={row} size={12} />
      <Dot x={150} y={row} size={12} />

      <Loop
        keyframes={OK_NODE}
        options={STEP_OPTIONS}
        sx={{ borderRadius: "50%", opacity: 0, bgcolor: "primary.main" }}
        style={centered(90, row, 16)}
      />
      <Loop
        keyframes={FAIL_FLICKER}
        options={FAIL_FLICKER_OPTIONS}
        sx={{ borderRadius: "50%", bgcolor: "error.main" }}
        style={centered(90, row, 16)}
      />
      <Loop
        keyframes={RECONNECT}
        options={RECONNECT_OPTIONS}
        sx={{ borderRadius: "50%", border: 1, borderColor: "primary.main", opacity: 0 }}
        style={centered(90, row, 16)}
      />
    </>
  );
}

export function SystemScene({ kind }: { kind: SystemSceneKind }) {
  return (
    <Box
      aria-hidden="true"
      sx={(theme) => {
        const palette = (theme.vars ?? theme).palette;
        return {
          position: "relative",
          width: WIDTH,
          height: HEIGHT,
          maxWidth: "100%",
          // The form area is a flex column whose Stack resets child margins, so margin: auto cannot center.
          alignSelf: "center",
          "& svg": { position: "absolute", inset: 0 },
          "& .sc-link": { stroke: palette.secondary.main, strokeWidth: 1.4, strokeOpacity: 0.4 },
          "& .sc-link-solid": { bgcolor: palette.secondary.main },
          "& .sc-node": { bgcolor: palette.primary.main },
          "& .sc-arm": { background: `linear-gradient(to right, ${palette.primary.main}, transparent)` },
          "& .sc-broken": { borderColor: palette.error.main },
          "& .sc-lock": { borderColor: palette.warning.main },
          "& .sc-lock-body": { bgcolor: palette.warning.main },
        };
      }}
    >
      {kind === "lost" && <LostScene />}
      {kind === "locked" && <LockedScene />}
      {kind === "failed" && <FailedScene />}
    </Box>
  );
}
