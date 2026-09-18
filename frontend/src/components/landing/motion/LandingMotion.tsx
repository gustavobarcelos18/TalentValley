"use client";

import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

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
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (policy !== "desktop") {
      if (lenisRef.current) {
        lenisRef.current.destroy();
        lenisRef.current = null;
      }
      return;
    }

    // Register ScrollTrigger once for the landing scope.
    gsap.registerPlugin(ScrollTrigger);

    const lenis = new Lenis({
      smoothWheel: true,
      syncTouch: false,
      lerp: 0.12,
      autoRaf: false,
      respectReducedMotion: true,
    });
    lenisRef.current = lenis;

    // Keep GSAP ScrollTrigger measurements in sync with Lenis scroll updates.
    lenis.on("scroll", ScrollTrigger.update);

    // Drive Lenis from the GSAP ticker instead of a separate RAF loop.
    gsap.ticker.add((time) => lenis.raf(time * 1000));

    return () => {
      gsap.ticker.remove((time) => lenis.raf(time * 1000));
      lenis.off("scroll", ScrollTrigger.update);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [policy]);

  return <MotionPolicyContext.Provider value={policy}>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </MotionPolicyContext.Provider>;
}

export function useLandingMotionPolicy() {
  return useContext(MotionPolicyContext);
}
