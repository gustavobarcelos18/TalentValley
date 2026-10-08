"use client";

import { Box } from "@mui/material";
import { keyframes } from "@mui/material/styles";

const sweep = keyframes`
  from { background-position: 130% 0; }
  to { background-position: -30% 0; }
`;

const pulse = keyframes`
  from { opacity: 0.7; transform: scale(1); }
  to { opacity: 0; transform: scale(1.06, 1.35); }
`;

/** `sx` for a contained button: a band of light sweeps across it once when the pointer enters. */
export const shimmerSx = {
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    pointerEvents: "none",
    opacity: 0,
    backgroundImage: "linear-gradient(110deg, transparent 35%, rgb(255 255 255 / 0.28) 50%, transparent 65%)",
    backgroundSize: "250% 100%",
    backgroundPosition: "130% 0",
  },
  "&:hover:not(.Mui-disabled)::before": {
    opacity: 1,
    animation: `${sweep} 700ms ease-out`,
  },
  "@media (prefers-reduced-motion: reduce)": { "&::before": { display: "none" } },
} as const;

/**
 * A ring that expands out of the parent and fades, for drawing the eye to a button. The parent must
 * be `position: relative`. Remount it (change its `key`) to play it again.
 */
export function PulseRing({ iterations = 1, delay = 0 }: { iterations?: number; delay?: number }) {
  return (
    <Box
      component="span"
      aria-hidden="true"
      sx={{
        position: "absolute",
        inset: 0,
        borderRadius: "inherit",
        border: 2,
        borderColor: "primary.light",
        pointerEvents: "none",
        opacity: 0,
        animation: `${pulse} 1.4s ease-out ${delay}s ${iterations} backwards`,
        "@media (prefers-reduced-motion: reduce)": { display: "none" },
      }}
    />
  );
}
