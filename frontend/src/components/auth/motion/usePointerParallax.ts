"use client";

import { useEffect, type RefObject } from "react";
import { useMotionValue, useSpring } from "framer-motion";
import { spring } from "./tokens";
import { useMotionPolicy } from "./useMotionPolicy";

/**
 * Smoothed pointer position inside `ref`, only on wide screens with a fine pointer
 * (inactive on touch and with reduced motion, where every value stays at rest).
 *
 * - `x`/`y`: -0.5..0.5 from the center, easing back to 0 when the pointer leaves (parallax).
 * - `spotX`/`spotY`: 0..1 from the top-left, kept where the pointer left; `presence` fades 0..1 (spotlight).
 */
export function usePointerParallax(ref: RefObject<HTMLElement | null>) {
  const policy = useMotionPolicy();

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const rawSpotX = useMotionValue(0.5);
  const rawSpotY = useMotionValue(0.5);
  const rawPresence = useMotionValue(0);

  const x = useSpring(rawX, spring.soft);
  const y = useSpring(rawY, spring.soft);
  const spotX = useSpring(rawSpotX, spring.soft);
  const spotY = useSpring(rawSpotY, spring.soft);
  const presence = useSpring(rawPresence, spring.soft);

  useEffect(() => {
    const element = ref.current;
    if (policy !== "pointer" || !element) return;

    function onMove(event: PointerEvent) {
      const rect = element!.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      rawX.set(px - 0.5);
      rawY.set(py - 0.5);
      rawSpotX.set(px);
      rawSpotY.set(py);
      rawPresence.set(1);
    }

    function onLeave() {
      rawX.set(0);
      rawY.set(0);
      rawPresence.set(0);
    }

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", onLeave);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", onLeave);
      onLeave();
    };
  }, [policy, ref, rawX, rawY, rawSpotX, rawSpotY, rawPresence]);

  return { x, y, spotX, spotY, presence };
}
