"use client";

import { useEffect } from "react";
import { useAnimate } from "framer-motion";
import { duration, ease } from "./tokens";
import { shakeKeyframes } from "./variants";
import { useMotionPolicy } from "./useMotionPolicy";

/** Shakes the element on the returned ref each time `trigger` changes to a non-zero value. */
export function useShake<T extends HTMLElement>(trigger: number) {
  const [scope, animate] = useAnimate<T>();
  const policy = useMotionPolicy();
  const moves = policy === "pointer" || policy === "touch";

  useEffect(() => {
    if (trigger === 0 || !moves || !scope.current) return;
    const element = scope.current;
    animate(element, { transform: shakeKeyframes }, { duration: duration.slow, ease: ease.inOut }).then(() => {
      // Framer leaves the last frame inline; a resting transform would still make a containing block.
      element.style.transform = "";
    });
  }, [trigger, moves, animate, scope]);

  return scope;
}
