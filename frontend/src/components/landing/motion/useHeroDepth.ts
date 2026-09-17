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
      const scroll = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true },
      });
      scroll.to(".hero-background-scroll", { y: mobile ? 12 : 65 }, 0)
        .to(".hero-atmosphere", { y: mobile ? 5 : 28 }, 0)
        .to(".hero-copy", { y: mobile ? -5 : -24 }, 0)
        .to(".hero-exit-shade", { opacity: 1 }, 0);

      if (!mobile) {
        scroll.to(".hero-topography", { y: 35 }, 0)
          .to(".hero-network", { y: -14 }, 0);
        const path = hero.querySelector<SVGPathElement>(".hero-network path:not([stroke-dasharray])");
        if (path) {
          const length = path.getTotalLength();
          gsap.fromTo(path, { strokeDasharray: length, strokeDashoffset: length * 0.7 }, {
            strokeDashoffset: 0, ease: "none",
            scrollTrigger: { trigger: hero, start: "top top", end: "bottom 35%", scrub: true },
          });
        }
      }

      if (!context.conditions?.pointer || navigator.maxTouchPoints > 0) return;
      const layers = [
        { selector: ".hero-background", depth: 9 },
        { selector: ".hero-topography-depth", depth: 6 },
        { selector: ".hero-network-depth", depth: -8 },
        { selector: ".hero-copy-depth", depth: -2 },
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
