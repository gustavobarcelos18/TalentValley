"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { useLandingMotionPolicy } from "./LandingMotion";
import "./scrollTriggerSetup";

/** One reversible scrub per section; ambient tweens share a visibility observer. */
export function useSectionStories(ref: RefObject<HTMLElement | null>) {
  const policy = useLandingMotionPolicy();

  useEffect(() => {
    const root = ref.current;
    if (!root || policy === "pending" || policy === "reduced") return;
    const mobile = policy === "mobile";
    const d = mobile ? 0.3 : 1;
    const ambient = new Map<Element, gsap.core.Timeline>();
    const visible = new Set<Element>();
    const updateAmbient = () => ambient.forEach((timeline, section) => {
      if (visible.has(section) && !document.hidden) timeline.play();
      else timeline.pause();
    });
    // Freeze ambient loops while scrolling so they never compete with the scrub for the main thread.
    let idleTimer: number | undefined;
    let scrollFrame: number | undefined;
    const onScroll = () => {
      ambient.forEach(timeline => timeline.pause());
      window.clearTimeout(idleTimer);
      // Throttle the resume timer to once per frame instead of churning a timeout on every scroll event.
      if (scrollFrame === undefined) {
        scrollFrame = window.requestAnimationFrame(() => {
          scrollFrame = undefined;
          idleTimer = window.setTimeout(updateAmbient, 150);
        });
      }
    };
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
        const timeline = gsap.timeline({
          defaults: { ease: "none", duration: 1 },
          scrollTrigger: { trigger: section, start: value ? "top bottom" : "top 95%", end: "bottom top", scrub: true, invalidateOnRefresh: true },
        });
        const from = (selector: string, vars: gsap.TweenVars, at = 0) => {
          const elements = select(selector);
          if (elements.length) timeline.from(elements, vars, at);
        };
        const depth = (selector: string, y: number) => {
          const elements = select(selector);
          if (elements.length) timeline.fromTo(elements, { y: -y * d }, { y: y * d }, 0);
        };
        from(".eyebrow", { y: 50 * d, opacity: 0, duration: 0.25 });
        if (value) {
          from(".value-cover", { y: mobile ? 70 : 190, duration: 0.6 });
          from(".title-plane", { yPercent: 115, opacity: 0, scale: 0.97, stagger: mobile ? 0.04 : 0.08, duration: mobile ? 0.16 : 0.32 }, mobile ? 0.02 : 0.08);
          from(".value-grid article", { y: 45 * d, opacity: 0, stagger: 0.04, duration: mobile ? 0.16 : 0.25 }, mobile ? 0.12 : 0.24);
        } else {
          from("h2", { y: (company ? 115 : 85) * d, opacity: 0, duration: mobile ? 0.2 : 0.35 }, 0.04);
          from(".audience-copy > p:not(.eyebrow), .institution-copy > p:not(.eyebrow)", { y: 20 * d, opacity: 0, stagger: 0.04, duration: 0.25 }, 0.1);
        }
        depth(".story-continuity", -90);
        // SVG <g> groups can't become compositor layers, so per-group parallax forced a full
        // scene re-rasterization every frame. Move the whole scene as one promotable layer.
        depth(".valley-scene", 45);
        depth(".panel-glow", -100);
        if (company) {
          from(".network-orbit", { scale: 1.35, rotation: 8, duration: 0.65 });
          from(".story-paths", { scale: 1.3, opacity: 0.15, duration: 0.65 });
          from(".label-one", { x: -55 * d, y: -65 * d, duration: 0.65 });
          from(".label-two", { x: 65 * d, y: -40 * d, duration: 0.65 });
          from(".label-three", { y: 80 * d, duration: 0.65 });
        } else {
          depth(".story-paths", -45);
          depth(".label-one", -55);
          depth(".label-two", 38);
          depth(".label-three", -28);
          from(".network-orbit", { rotation: -7, scale: 1.12 });
        }
        from(".network-center", { scale: 0.88, duration: 0.5 });
        from(".ecosystem-words span", { y: (index: number) => (24 + index * 9) * d, opacity: 0, stagger: 0.035, duration: 0.4 }, 0.1);
        // The original institutional logo is never transformed or filtered.
        from(".institution-brand", { opacity: 0, duration: 0.3 });

        if (!mobile && select(".panel-glow").length) {
          const loop = gsap.timeline({ paused: true, repeat: -1, yoyo: true })
            .fromTo(select(".panel-glow"), { opacity: 0.35 }, { opacity: 0.75, duration: 4, ease: "sine.inOut" }, 0)
            .fromTo(select(".network-center svg"), { opacity: 0.65 }, { opacity: 1, duration: 3, ease: "sine.inOut" }, 0)
            // Opacity pulse instead of stroke-dashoffset: dash animation re-rasterizes the SVG path
            // every frame, while opacity stays on the compositor.
            .fromTo(select(".path-light"), { opacity: 0.25 }, { opacity: 0.9, duration: 4, ease: "sine.inOut" }, 0);
          ambient.set(section, loop);
          observer.observe(section);
        }
      });
    }, root);
    document.addEventListener("visibilitychange", updateAmbient);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateAmbient);
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(idleTimer);
      if (scrollFrame !== undefined) window.cancelAnimationFrame(scrollFrame);
      context.revert();
    };
  }, [policy, ref]);
}
