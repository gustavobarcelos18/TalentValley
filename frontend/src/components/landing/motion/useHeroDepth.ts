"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { motionQueries, useLandingMotionPolicy } from "./LandingMotion";

export function useHeroDepth(ref: RefObject<HTMLElement | null>) {
  const policy = useLandingMotionPolicy();

  useEffect(() => {
    const hero = ref.current;
    if (!hero || policy === "pending" || policy === "reduced") return;
    gsap.registerPlugin(ScrollTrigger);
    // matchMedia owns a scoped GSAP context and reverts every tween/trigger.
    const media = gsap.matchMedia();
    media.add({ motion: "(prefers-reduced-motion: no-preference)", pointer: motionQueries.pointer }, context => {
      if (!context.conditions?.motion) return;
      const mobile = policy === "mobile";
      const distance = mobile ? 0.32 : 1;
      const scroll = gsap.timeline({
        defaults: { ease: "none", duration: 1 },
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true },
      });
      scroll.to(".hero-background-scroll", { y: 40 * distance, scale: 1.04 }, 0)
        .to(".hero-atmosphere", { y: -100 * distance, x: 45 * distance }, 0)
        .to(".hero-technology", { y: -70 * distance, scale: 1.06 }, 0)
        .to(".hero-headline-scroll", { y: -230 * distance, scale: 0.94, opacity: 0, duration: 0.65 }, 0)
        .to(".hero-subtitle-scroll", { y: -140 * distance, opacity: 0, duration: 0.55 }, 0.08)
        .to(".hero-institutional-scroll", { y: -90 * distance, opacity: 0, duration: 0.5 }, 0.12)
        .to(".hero-actions-scroll", { y: -60 * distance, opacity: 0, duration: 0.4 }, 0.22)
        .to(".explore-link", { y: 75 * distance, opacity: 0, duration: 0.22 }, 0)
        .to(".hero-exit-shade", { opacity: 1 }, 0);

      if (!context.conditions?.pointer || navigator.maxTouchPoints > 0) return;
      const layers = [
        { selector: ".hero-background", depth: 20 },
        { selector: ".hero-technology-depth", depth: -36 },
        { selector: ".hero-copy-depth", depth: -5 },
      ].flatMap(({ selector, depth }) => {
        const element = hero.querySelector(selector);
        return element ? [{ depth,
          x: gsap.quickTo(element, "x", { duration: 0.7, ease: "power3.out" }),
          y: gsap.quickTo(element, "y", { duration: 0.7, ease: "power3.out" }),
        }] : [];
      });
      // Read viewport dimensions on resize, never measure layout in pointermove.
      let width = window.innerWidth;
      let height = window.innerHeight;
      const resize = () => { width = window.innerWidth; height = window.innerHeight; };
      const move = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        const x = event.clientX / width * 2 - 1;
        const y = event.clientY / height * 2 - 1;
        layers.forEach(layer => { layer.x(x * layer.depth); layer.y(y * layer.depth); });
      };
      const reset = () => layers.forEach(layer => { layer.x(0); layer.y(0); });
      hero.addEventListener("pointermove", move, { passive: true });
      hero.addEventListener("pointerleave", reset);
      window.addEventListener("resize", resize, { passive: true });
      return () => {
        hero.removeEventListener("pointermove", move);
        hero.removeEventListener("pointerleave", reset);
        window.removeEventListener("resize", resize);
      };
    }, hero);
    return () => media.revert();
  }, [policy, ref]);
}
