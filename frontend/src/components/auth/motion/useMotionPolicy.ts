"use client";

import { useSyncExternalStore } from "react";
import { motionQueries } from "@/components/landing/motion/LandingMotion";

/**
 * - `pending`: server and first hydration render, no effect runs yet.
 * - `reduced`: `prefers-reduced-motion`; only short fades are allowed.
 * - `touch`: animations on, but no pointer-driven effects (spotlight, parallax).
 * - `pointer`: fine pointer on a wide screen; every effect is allowed.
 */
export type MotionPolicy = "pending" | "reduced" | "touch" | "pointer";

function subscribe(onChange: () => void) {
  const queries = [motionQueries.reduced, motionQueries.pointer].map((query) => window.matchMedia(query));
  queries.forEach((query) => query.addEventListener("change", onChange));
  return () => queries.forEach((query) => query.removeEventListener("change", onChange));
}

function snapshot(): MotionPolicy {
  if (window.matchMedia(motionQueries.reduced).matches) return "reduced";
  return window.matchMedia(motionQueries.pointer).matches ? "pointer" : "touch";
}

export function useMotionPolicy(): MotionPolicy {
  return useSyncExternalStore(subscribe, snapshot, () => "pending");
}
