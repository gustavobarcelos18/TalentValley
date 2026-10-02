"use client";

import type { ReactNode } from "react";
import { Button, CircularProgress } from "@mui/material";
import { useReducedMotion } from "framer-motion";
import { CheckDraw } from "./motion/CheckDraw";
import { MagneticButton } from "./motion/MagneticButton";
import { PulseRing, shimmerSx } from "./motion/buttonEffects";
import type { RetryCountdown } from "./motion/useRetryCountdown";

interface AuthSubmitButtonProps {
  children: ReactNode;
  /** Announced to assistive technology while the spinner replaces the label. */
  loadingLabel: string;
  loading?: boolean;
  /** Shows the drawn check instead of the label; the screen then leaves on its own. */
  success?: boolean;
  /** Rate-limit wait: the button shows the countdown and comes back with a pulse. */
  retry?: RetryCountdown;
}

function formatCountdown(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const RING_RADIUS = 9;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function CountdownRing({ remaining, total }: { remaining: number; total: number }) {
  const reduced = useReducedMotion();
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" strokeWidth="3" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r={RING_RADIUS} stroke="currentColor" opacity="0.25" />
      <circle
        cx="12"
        cy="12"
        r={RING_RADIUS}
        stroke="currentColor"
        strokeLinecap="round"
        strokeDasharray={RING_LENGTH}
        strokeDashoffset={RING_LENGTH * (1 - remaining / total)}
        transform="rotate(-90 12 12)"
        style={reduced ? undefined : { transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  );
}

// Primary action of an entry form: leans toward the cursor, shimmers on hover, and swaps its label for
// a spinner (sending), a drawn check (done) or a countdown ring (rate limited).
export function AuthSubmitButton({ children, loadingLabel, loading = false, success = false, retry }: AuthSubmitButtonProps) {
  const waiting = retry !== undefined && retry.remaining > 0;
  // While the check shows, `loading` is still true; the button must keep its normal colors then.
  const disabled = (loading && !success) || waiting;

  let content: ReactNode = children;
  if (success) {
    content = (
      <>
        <CheckDraw size={24} circle={false} strokeWidth={2.5} />
        <span className="sr-only">{loadingLabel}</span>
      </>
    );
  } else if (loading) {
    content = (
      <>
        <CircularProgress size={22} color="inherit" disableShrink aria-hidden="true" />
        <span className="sr-only">{loadingLabel}</span>
      </>
    );
  } else if (waiting) {
    content = (
      <>
        <CountdownRing remaining={retry.remaining} total={retry.total} />
        <span style={{ marginLeft: 10 }}>Tente de novo em {formatCountdown(retry.remaining)}</span>
      </>
    );
  }

  return (
    <MagneticButton disabled={disabled || success}>
      <Button
        type={success ? "button" : "submit"}
        variant="contained"
        size="large"
        fullWidth
        disabled={disabled}
        sx={{ position: "relative", ...shimmerSx }}
      >
        {content}
        {retry !== undefined && retry.finished > 0 && !waiting && <PulseRing key={retry.finished} />}
      </Button>
    </MagneticButton>
  );
}
