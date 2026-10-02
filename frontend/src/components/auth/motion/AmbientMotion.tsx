"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import {
  useAnimate,
  type AnimationOptions,
  type AnimationPlaybackControls,
  type DOMKeyframesDefinition,
} from "framer-motion";
import { useMotionPolicy } from "./useMotionPolicy";

interface AmbientState {
  /** Loops exist at all: off while pending and with reduced motion. */
  enabled: boolean;
  /** Loops are playing: paused while the tab is hidden or the screen is out of view. */
  active: boolean;
}

const AmbientContext = createContext<AmbientState>({ enabled: false, active: false });

/** Decides whether the decorative loops below it exist and whether they are currently playing. */
export function AmbientMotion({ active, children }: { active: boolean; children: ReactNode }) {
  const policy = useMotionPolicy();
  const enabled = policy === "touch" || policy === "pointer";
  return <AmbientContext.Provider value={{ enabled, active: enabled && active }}>{children}</AmbientContext.Provider>;
}

export function useAmbient() {
  return useContext(AmbientContext);
}

/**
 * Endless loop on the returned ref, paused whenever the ambient state is inactive.
 * `keyframes` and `options` must be stable (module constants or memoized).
 */
export function useLoop<T extends Element>(keyframes: DOMKeyframesDefinition, options: AnimationOptions) {
  const { enabled, active } = useAmbient();
  const [scope, animate] = useAnimate<T>();
  const playback = useRef<AnimationPlaybackControls | null>(null);

  useEffect(() => {
    if (!enabled || !scope.current) return;
    const controls = animate(scope.current, keyframes, { ...options, repeat: Infinity });
    playback.current = controls;
    return () => {
      controls.cancel();
      playback.current = null;
    };
  }, [enabled, animate, scope, keyframes, options]);

  useEffect(() => {
    if (active) playback.current?.play();
    else playback.current?.pause();
  }, [active, enabled]);

  return scope;
}
