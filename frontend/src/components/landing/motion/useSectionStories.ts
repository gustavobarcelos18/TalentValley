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
        const reveal = gsap.timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: { trigger: section, start: "top 80%", once: true },
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
        depth("[data-scene-layer='distant']", 55);
        depth("[data-scene-layer='facets']", 90);
        depth("[data-scene-layer='mesh'], [data-scene-layer='contours']", 30);
        depth("[data-scene-layer='connections']", -65);
        depth(".panel-glow", -100);
        if (company) {
          depthFrom(".network-orbit", { scale: 1.35, rotation: 8, duration: 0.65 });
          depthFrom(".story-paths", { scale: 1.3, opacity: 0.15, duration: 0.65 });
          depthFrom(".label-one", { x: -55 * d, y: -65 * d, duration: 0.65 });
          depthFrom(".label-two", { x: 65 * d, y: -40 * d, duration: 0.65 });
          depthFrom(".label-three", { y: 80 * d, duration: 0.65 });
        } else {
          depth(".story-paths", -45);
          depth(".label-one", -55);
          depth(".label-two", 38);
          depth(".label-three", -28);
          depthFrom(".network-orbit", { rotation: -7, scale: 1.12 });
        }
        depthFrom(".network-center", { scale: 0.88, duration: 0.5 });
        revealFrom(".ecosystem-words span", { y: (index: number) => (12 + index * 4) * d, autoAlpha: 0, stagger: 0.06, duration: 0.45 }, 0.24);
        // The original institutional logo is never transformed or filtered.
        revealFrom(".institution-brand", { autoAlpha: 0, duration: 0.55 }, 0.12);

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
