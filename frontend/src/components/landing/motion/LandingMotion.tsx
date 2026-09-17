"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";

export const motionQueries = {
  reduced: "(prefers-reduced-motion: reduce)",
  mobile: "(max-width: 767px)",
  pointer: "(min-width: 1024px) and (hover: hover) and (pointer: fine)",
};

type MotionPolicy = "pending" | "reduced" | "mobile" | "desktop";
const MotionPolicyContext = createContext<MotionPolicy>("pending");

function subscribe(onChange: () => void) {
  const queries = [motionQueries.reduced, motionQueries.mobile].map(query => window.matchMedia(query));
  queries.forEach(query => query.addEventListener("change", onChange));
  return () => queries.forEach(query => query.removeEventListener("change", onChange));
}

function snapshot(): MotionPolicy {
  if (window.matchMedia(motionQueries.reduced).matches) return "reduced";
  return window.matchMedia(motionQueries.mobile).matches ? "mobile" : "desktop";
}

export function LandingMotion({ children }: { children: ReactNode }) {
  // The server and the first hydration render are static and identical.
  const policy = useSyncExternalStore(subscribe, snapshot, () => "pending" as const);
  return <MotionPolicyContext.Provider value={policy}>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </MotionPolicyContext.Provider>;
}

export function useLandingMotionPolicy() {
  return useContext(MotionPolicyContext);
}
