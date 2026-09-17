"use client";

import { useEffect } from "react";
import { useAnimate } from "framer-motion";
import { useLandingMotionPolicy } from "./LandingMotion";

/** Opt-in entrance targets only; server-rendered content stays visible without JS. */
export function useLandingEntrance() {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const policy = useLandingMotionPolicy();

  useEffect(() => {
    if (policy === "pending" || !scope.current) return;
    const reduced = policy === "reduced";
    const mobile = policy === "mobile";
    const targets = Array.from(scope.current.querySelectorAll<HTMLElement>("[data-entrance]"))
      .filter(element => element.closest("[data-motion-scope]") === scope.current && element.getClientRects().length > 0);
    const animations = targets.map(element => {
      const delay = reduced ? 0 : Number(element.dataset.entrance) * (mobile ? 0.65 : 1);
      const fadeOnly = reduced || element.dataset.entranceFade !== undefined;
      return animate(element, {
        opacity: [0, 1],
        ...(fadeOnly ? {} : { y: [mobile ? 8 : 18, 0] }),
      }, { delay, duration: reduced ? 0.16 : mobile ? 0.45 : 0.75, ease: [0.22, 1, 0.36, 1] });
    });
    return () => {
      animations.forEach(animation => animation.stop());
      targets.forEach(element => {
        element.style.removeProperty("opacity");
        if (element.dataset.entranceFade === undefined) element.style.removeProperty("transform");
      });
    };
  }, [animate, policy, scope]);

  return scope;
}
