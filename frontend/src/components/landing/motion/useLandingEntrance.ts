"use client";

import { useLayoutEffect } from "react";
import { useAnimate } from "framer-motion";
import { useLandingMotionPolicy } from "./LandingMotion";
import { clearEntrancePrePaint } from "./entrancePrePaint";

/** Opt-in entrance targets only; server-rendered content stays visible without JS. */
export function useLandingEntrance() {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const policy = useLandingMotionPolicy();

  // A layout effect runs before paint: the hidden start state is applied in the same commit, so a
  // group that mounts after the first frame never paints once at full opacity before the reveal.
  useLayoutEffect(() => {
    // Still hydrating: the pre-paint class is what hides the server-rendered targets.
    if (policy === "pending" || !scope.current) return;
    if (policy === "reduced") {
      // No reveal and no hidden state: reduced-motion users keep the server-rendered content.
      clearEntrancePrePaint();
      return;
    }
    const mobile = policy === "mobile";
    const targets = Array.from(scope.current.querySelectorAll<HTMLElement>("[data-entrance]"))
      .filter(element => element.closest("[data-motion-scope]") === scope.current && element.getClientRects().length > 0);
    // A client-side navigation has no pre-paint class, so the hidden state is set in this commit.
    targets.forEach(element => { element.style.opacity = "0"; });
    const animations = targets.map(element => {
      const delay = Number(element.dataset.entrance) * (mobile ? 0.65 : 1);
      const fadeOnly = element.dataset.entranceFade !== undefined;
      return animate(element, {
        opacity: [0, 1],
        ...(fadeOnly ? {} : { y: [mobile ? 8 : 18, 0] }),
      }, { delay, duration: mobile ? 0.45 : 0.75, ease: [0.22, 1, 0.36, 1] });
    });
    clearEntrancePrePaint();
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
