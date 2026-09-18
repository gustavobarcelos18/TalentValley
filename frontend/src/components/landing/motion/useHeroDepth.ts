"use client";

import { useEffect, type RefObject } from "react";

import { motionQueries, useIsMotionVisible, useDepthFractionControl } from "./LandingMotion";

export function useHeroDepth(ref: RefObject<HTMLElement | null>) {
  const isVisible = useIsMotionVisible();
  const { setDepthFraction } = useDepthFractionControl();

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const element = ref.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === element) {
            setDepthFraction(entry.isIntersecting ? 1 : 0);
          }
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [isVisible, setDepthFraction, ref]);
}
