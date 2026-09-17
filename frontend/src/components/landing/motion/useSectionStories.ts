"use client";

import { useEffect, type RefObject } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLandingMotionPolicy } from "./LandingMotion";

/** One entry timeline per section; no pinning, loops, or per-frame React work. */
export function useSectionStories(ref: RefObject<HTMLElement | null>) {
  const policy = useLandingMotionPolicy();

  useEffect(() => {
    const root = ref.current;
    if (!root || policy === "pending" || policy === "reduced") return;
    gsap.registerPlugin(ScrollTrigger);
    let observer: IntersectionObserver | undefined;
    const timelines = new Map<Element, gsap.core.Timeline>();
    const context = gsap.context(() => {
      const sections = root.querySelectorAll<HTMLElement>("[data-story]");
      if (policy === "mobile") {
        // A single observer reveals local groups as they enter the tall mobile layout.
        // Network artwork is static: no path drawing or simultaneous depth layers.
        observer = new IntersectionObserver(entries => entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          timelines.get(entry.target)?.play();
          observer?.unobserve(entry.target);
        }), { rootMargin: "0px 0px -6% 0px" });
        sections.forEach(section => {
          section.querySelectorAll<HTMLElement>(".eyebrow, h2, .value-grid article, .audience-copy > p:not(.eyebrow), .benefits li, .company-note, .story-action, .network-panel, .institution-brand, .institution-copy > p:not(.eyebrow), .ecosystem-words").forEach(element => {
            const timeline = gsap.timeline({ paused: true }).from(element, {
              opacity: 0, y: 8, duration: 0.4, ease: "power2.out", clearProps: "opacity,transform",
            });
            timelines.set(element, timeline);
            observer?.observe(element);
          });
        });
        return;
      }

      sections.forEach(section => {
        const select = gsap.utils.selector(section);
        const timeline = gsap.timeline({
          defaults: { duration: 0.7, ease: "power2.out" },
          scrollTrigger: { trigger: section, start: "top 75%", once: true },
        });
        timelines.set(section, timeline);
        const reveal = (selector: string, at: number, stagger = 0.1, duration = 0.7) => {
          const elements = select(selector);
          if (elements.length) timeline.from(elements, { opacity: 0, y: 16, stagger, duration, clearProps: "opacity,transform" }, at);
        };
        const paths = (at: number, converge = false) => {
          section.querySelectorAll<SVGPathElement>(".story-paths path, [data-scene-layer='connections'] path:not([stroke-dasharray])").forEach((path, index) => {
            const length = path.getTotalLength();
            timeline.fromTo(path, { strokeDasharray: length, strokeDashoffset: converge ? -length : length }, {
              strokeDashoffset: 0, duration: 0.9, ease: "power1.inOut", clearProps: "strokeDasharray,strokeDashoffset",
            }, at + index * 0.12);
          });
        };
        timeline.from(select(".story-continuity"), { scaleX: 0, transformOrigin: "left", duration: 1.2, clearProps: "transform" }, 0);
        switch (section.dataset.story) {
          case "value":
            reveal(".eyebrow, h2", 0, 0.12);
            reveal(".value-grid article", 0.25, 0.16);
            break;
          case "talent":
            reveal(".eyebrow, h2", 0);
            reveal(".audience-copy > p:not(.eyebrow)", 0.2);
            timeline.from(select(".network-panel"), { opacity: 0, scale: 0.96, y: 20, duration: 1, clearProps: "opacity,transform" }, 0.35);
            paths(0.55);
            reveal(".network-label", 0.75, 0.2);
            timeline.from(select(".network-center"), { scale: 0.92, opacity: 0.4, clearProps: "opacity,transform" }, 1.3);
            reveal(".benefits li", 1.5, 0.14);
            reveal(".story-action", 1.95);
            break;
          case "company":
            reveal(".network-panel", 0, 0, 0.9);
            reveal(".network-label", 0.3, 0.18);
            paths(0.65, true);
            timeline.from(select(".network-center"), { opacity: 0, scale: 0.94, clearProps: "opacity,transform" }, 1.05);
            reveal(".eyebrow, h2, .audience-copy > p:not(.eyebrow), .company-note", 1.15, 0.12);
            reveal(".story-action", 1.8);
            break;
          case "how":
            reveal(".eyebrow, h2", 0);
            break;
          case "institution":
            // Fade the intact logo container; never transform/filter the original artwork.
            timeline.from(select(".institution-brand"), { opacity: 0, duration: 1.1, clearProps: "opacity" }, 0);
            reveal(".eyebrow, h2, .institution-copy > p:not(.eyebrow)", 0.25, 0.18, 1);
            reveal(".ecosystem-words span", 0.95, 0.18, 0.85);
            break;
        }
      });
    }, root);

    // Keyboard navigation must never land on an invisible, delayed action.
    const onFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      timelines.forEach((timeline, element) => {
        if (element.contains(event.target as Node)) timeline.progress(1);
      });
    };
    root.addEventListener("focusin", onFocus);
    return () => {
      root.removeEventListener("focusin", onFocus);
      observer?.disconnect();
      context.revert();
    };
  }, [policy, ref]);
}
