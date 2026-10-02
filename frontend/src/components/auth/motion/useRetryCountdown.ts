"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";

export interface RetryCountdown {
  /** Whole seconds left before the action can be tried again; 0 when free. */
  remaining: number;
  /** Seconds the wait started with, for drawing progress. */
  total: number;
  /** How many waits have run to zero; a changing value lets the UI play a one-off cue. */
  finished: number;
  /** Starts the wait when `error` is a 429 that says how long to wait; ignores anything else. */
  observe: (error: unknown) => void;
}

/** Countdown for a rate-limited (429) action, driven by the `Retry-After` the server sent. */
export function useRetryCountdown(): RetryCountdown {
  const [state, setState] = useState({ until: 0, total: 0, remaining: 0, finished: 0 });
  const waiting = state.remaining > 0;

  const observe = useCallback((error: unknown) => {
    if (!(error instanceof ApiError) || error.status !== 429 || !error.retryAfterSeconds) return;
    const seconds = error.retryAfterSeconds;
    setState((s) => ({ ...s, until: Date.now() + seconds * 1000, total: seconds, remaining: seconds }));
  }, []);

  // The clock is read from the deadline, so a throttled background tab still lands on the right second.
  useEffect(() => {
    if (!waiting) return;
    const id = window.setInterval(() => {
      setState((s) => {
        const remaining = Math.max(0, Math.ceil((s.until - Date.now()) / 1000));
        if (remaining === s.remaining) return s;
        return remaining === 0 ? { ...s, remaining, finished: s.finished + 1 } : { ...s, remaining };
      });
    }, 250);
    return () => window.clearInterval(id);
  }, [waiting]);

  return { remaining: state.remaining, total: state.total, finished: state.finished, observe };
}
