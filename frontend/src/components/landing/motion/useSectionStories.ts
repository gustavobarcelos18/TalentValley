"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLandingMotionPolicy } from "./LandingMotion";

/** Independent content reveals and reversible depth scrubs; ambient tweens share a visibility observer. */
export function useSectionStories(ref: RefObject<HTMLElement | null>) {
  const policy = useLandingMotionPolicy();

  useEffect(() => {
    const root = ref.current;
    if (!root || policy === "pending" || policy === "reduced") return;
    gsap.registerPlugin(ScrollTrigger);
    const mobile = policy === "mobile";
    const d = mobile ? 0.3 : 1;
    const ambient = new Map<Element, gsap.core.Timeline>();
    const visible = new Set<Element>();
    const updateAmbient = () => ambient.forEach((timeline, section) => {
      if (visible.has(section) && !document.hidden) timeline.play();
      else timeline.pause();
    });
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visible.add(entry.target);
        else visible.delete(entry.target);
      });
      updateAmbient();
    });
    const context = gsap.context(() => {
      root.querySelectorAll<HTMLElement>("[data-story]").forEach(section => {
        const select = gsap.utils.selector(section);
        const value = section.dataset.story === "value";
        const company = section.dataset.story === "company";
        const revealTimeline = gsap.timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: { trigger: section, start: value ? "top 80%" : "top 85%", once: true },
        });
        const reveal = (selector: string, vars: gsap.TweenVars, at = 0) => {
          const elements = select(selector);
          if (elements.length) revealTimeline.from(elements, {
            ...vars,
            clearProps: "transform,opacity,visibility",
          }, at);
        };
        reveal(".eyebrow", { y: mobile ? 20 : 32, autoAlpha: 0, duration: mobile ? 0.5 : 0.65 });
        if (value) {
          reveal(".title-plane", { y: mobile ? 24 : 32, autoAlpha: 0, scale: 0.98, stagger: mobile ? 0.04 : 0.08, duration: mobile ? 0.55 : 0.7 }, 0.08);
          reveal(".value-grid article", { y: mobile ? 24 : 36, autoAlpha: 0, stagger: 0.08, duration: mobile ? 0.5 : 0.6 }, 0.22);
        } else {
          reveal("h2", { y: mobile ? 28 : 40, autoAlpha: 0, duration: mobile ? 0.55 : 0.7 }, 0.08);
          reveal(".audience-copy > p:not(.eyebrow), .institution-copy > p:not(.eyebrow)", { y: 20, autoAlpha: 0, stagger: 0.06, duration: 0.55 }, 0.18);
        }
        reveal(".ecosystem-words span", { y: mobile ? 16 : 24, autoAlpha: 0, stagger: 0.05, duration: 0.5 }, 0.28);
        // The original institutional logo is never transformed or filtered.
        reveal(".institution-brand", { autoAlpha: 0, duration: 0.6 }, 0.12);

        const depthTimeline = gsap.timeline({
          defaults: { ease: "none", duration: 1 },
          scrollTrigger: { trigger: section, start: value ? "top bottom" : "top 95%", end: "bottom top", scrub: 0.6, invalidateOnRefresh: true },
        });
        const fromDepth = (selector: string, vars: gsap.TweenVars, at = 0) => {
          const elements = select(selector);
          if (elements.length) depthTimeline.from(elements, vars, at);
        };
        const depth = (selector: string, y: number) => {
          const elements = select(selector);
          if (elements.length) depthTimeline.fromTo(elements, { y: -y * d }, { y: y * d }, 0);
        };
        if (value) {
          fromDepth(".value-cover", { y: mobile ? 70 : 190, duration: 0.6 });
        }
        depth(".story-continuity", -90);
        depth("[data-scene-layer='distant']", 55);
        depth("[data-scene-layer='facets']", 90);
        depth("[data-scene-layer='mesh'], [data-scene-layer='contours']", 30);
        depth("[data-scene-layer='connections']", -65);
        depth(".panel-glow", -100);
        if (company) {
          fromDepth(".network-orbit", { scale: 1.35, rotation: 8, duration: 0.65 });
          fromDepth(".story-paths", { scale: 1.3, opacity: 0.15, duration: 0.65 });
          fromDepth(".label-one", { x: -55 * d, y: -65 * d, duration: 0.65 });
          fromDepth(".label-two", { x: 65 * d, y: -40 * d, duration: 0.65 });
          fromDepth(".label-three", { y: 80 * d, duration: 0.65 });
        } else {
          depth(".story-paths", -45);
          depth(".label-one", -55);
          depth(".label-two", 38);
          depth(".label-three", -28);
          fromDepth(".network-orbit", { rotation: -7, scale: 1.12 });
        }
        fromDepth(".network-center", { scale: 0.88, duration: 0.5 });

        if (!mobile && select(".panel-glow").length) {
          const loop = gsap.timeline({ paused: true, repeat: -1, yoyo: true })
            .fromTo(select(".panel-glow"), { opacity: 0.35 }, { opacity: 0.75, duration: 4, ease: "sine.inOut" }, 0)
            .fromTo(select(".network-center svg"), { opacity: 0.65 }, { opacity: 1, duration: 3, ease: "sine.inOut" }, 0)
            .fromTo(select(".path-light"), { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: 4, ease: "none" }, 0);
          ambient.set(section, loop);
          observer.observe(section);
        }
      });
    }, root);
    document.addEventListener("visibilitychange", updateAmbient);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateAmbient);
      context.revert();
    };
  }, [policy, ref]);
}
