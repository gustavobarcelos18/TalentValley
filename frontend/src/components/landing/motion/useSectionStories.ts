"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { useLandingMotionPolicy } from "./LandingMotion";
import "./scrollTriggerSetup";

/** Independent content reveals and reversible depth scrubs. */
export function useSectionStories(ref: RefObject<HTMLElement | null>) {
  const policy = useLandingMotionPolicy();

  useEffect(() => {
    const root = ref.current;
    if (!root || policy === "pending" || policy === "reduced") return;
    const mobile = policy === "mobile";
    const d = mobile ? 0.3 : 1;
    const context = gsap.context(() => {
      root.querySelectorAll<HTMLElement>("[data-story]").forEach(section => {
        const select = gsap.utils.selector(section);
        const value = section.dataset.story === "value";
        const company = section.dataset.story === "company";
        const reveal = gsap.timeline({
          defaults: { ease: "power3.out" },
          // The VALUE section replays its entrance when re-entered from below or above;
          // every other section reveals once. "restart" re-runs the from() tweens from the
          // hidden state, while "reverse" smoothly returns them to it as the section leaves.
          scrollTrigger: value
            ? { trigger: section, start: "top 80%", end: "bottom top", toggleActions: "restart reverse restart reverse" }
            : { trigger: section, start: "top 80%", once: true },
        });
        const depthTimeline = gsap.timeline({
          defaults: { ease: "none", duration: 1 },
          scrollTrigger: { trigger: section, start: value ? "top bottom" : "top 95%", end: "bottom top", scrub: 0.6, invalidateOnRefresh: true },
        });
        const revealFrom = (selector: string, vars: gsap.TweenVars, at = 0) => {
          const elements = select(selector);
          if (elements.length) reveal.from(elements, { ...vars, clearProps: "transform,opacity,visibility" }, at);
        };
        const depthFrom = (selector: string, vars: gsap.TweenVars, at = 0) => {
          const elements = select(selector);
          if (elements.length) depthTimeline.from(elements, vars, at);
        };
        const depth = (selector: string, y: number) => {
          const elements = select(selector);
          if (elements.length) depthTimeline.fromTo(elements, { y: -y * d }, { y: y * d }, 0);
        };
        revealFrom(".eyebrow", { y: mobile ? 15 : 24, autoAlpha: 0, duration: mobile ? 0.45 : 0.55 });
        if (value) {
          depthFrom(".value-cover", { y: mobile ? 70 : 190, duration: 0.6 });
          revealFrom(".title-plane", { y: mobile ? 24 : 32, autoAlpha: 0, scale: 0.98, stagger: 0.08, duration: mobile ? 0.55 : 0.7 }, 0.08);
          revealFrom(".value-grid article", { y: mobile ? 18 : 32, autoAlpha: 0, stagger: 0.08, duration: mobile ? 0.45 : 0.6 }, 0.24);
        } else {
          revealFrom("h2", { y: mobile ? 24 : company ? 48 : 36, autoAlpha: 0, duration: mobile ? 0.55 : 0.7 }, 0.06);
          revealFrom(".audience-copy > p:not(.eyebrow), .institution-copy > p:not(.eyebrow)", { y: mobile ? 12 : 20, autoAlpha: 0, stagger: 0.08, duration: mobile ? 0.45 : 0.55 }, 0.16);
        }
        depth(".story-continuity", -90);
        // SVG <g> groups can't become compositor layers, so per-group parallax forced a full
        // scene re-rasterization every frame. Move the whole scene as one promotable layer.
        depth(".valley-scene", 45);
        revealFrom(".product-preview", { y: mobile ? 24 : 40, autoAlpha: 0, duration: mobile ? 0.55 : 0.7 }, 0.2);
        revealFrom(".ecosystem-words span", { y: (index: number) => (12 + index * 4) * d, autoAlpha: 0, stagger: 0.06, duration: 0.45 }, 0.24);
        // The original institutional logo is never transformed or filtered.
        revealFrom(".institution-brand", { autoAlpha: 0, duration: 0.55 }, 0.12);
      });
    }, root);
    return () => context.revert();
  }, [policy, ref]);
}
