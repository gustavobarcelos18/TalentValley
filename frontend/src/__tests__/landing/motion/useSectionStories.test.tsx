import type { ReactNode, RefObject } from "react";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingMotion } from "@/components/landing/motion/LandingMotion";
import { useSectionStories } from "@/components/landing/motion/useSectionStories";
import { stubLandingMedia, type LandingMedia } from "./landingMedia";

type TweenVars = Record<string, unknown> & { y?: number | ((index: number) => number) };
type Call = { method: "from" | "fromTo"; elements: HTMLElement[]; args: unknown[] };
type TimelineRecord = { config: { defaults: object; scrollTrigger: Record<string, unknown> }; calls: Call[] };
type Step = [string, ...unknown[]];

const gsapState = vi.hoisted(() => ({
  context: vi.fn(),
  revert: vi.fn(),
  timelines: [] as unknown[],
}));

vi.mock("@/components/landing/motion/scrollTriggerSetup", () => ({}));
vi.mock("gsap", () => {
  const timeline = (config: unknown) => {
    const record = { config, calls: [] as unknown[] };
    gsapState.timelines.push(record);
    const chain = {
      from: (elements: HTMLElement[], ...args: unknown[]) => {
        record.calls.push({ method: "from", elements, args });
        return chain;
      },
      fromTo: (elements: HTMLElement[], ...args: unknown[]) => {
        record.calls.push({ method: "fromTo", elements, args });
        return chain;
      },
    };
    return chain;
  };
  const selector = (section: HTMLElement) => (query: string) => Array.from(section.querySelectorAll<HTMLElement>(query));
  return { gsap: { context: (...args: unknown[]) => gsapState.context(...args), timeline, utils: { selector } } };
});

const SEL = {
  eyebrow: ".eyebrow",
  title: "h2",
  copy: ".audience-copy > p:not(.eyebrow), .institution-copy > p:not(.eyebrow)",
  continuity: ".story-continuity",
  valley: ".valley-scene",
  preview: ".product-preview",
  words: ".ecosystem-words span",
  brand: ".institution-brand",
  cover: ".value-cover",
  plane: ".title-plane",
  grid: ".value-grid article",
};
const SELECTORS = Object.values(SEL);
const CLEAR = "transform,opacity,visibility";
const TOP_80 = "top 80%";
const BOTTOM_TOP = "bottom top";

const SECTION_MARKUP = `
  <p class="eyebrow">Eyebrow</p><h2>Titulo</h2>
  <div class="audience-copy"><p class="eyebrow">Eyebrow</p><p>Texto do talento</p></div>
  <div class="institution-copy"><p>Texto do instituto</p></div>
  <div class="story-continuity"></div><div class="valley-scene"></div><div class="product-preview"></div>
  <div class="ecosystem-words"><span>a</span><span>b</span><span>c</span></div><div class="institution-brand"></div>
  <div class="value-cover"></div><div class="title-plane"></div><div class="title-plane"></div>
  <div class="value-grid"><article></article><article></article></div>`;

function buildRoot(sections: { story: string; markup?: string }[]) {
  const root = document.createElement("main");
  sections.forEach(({ story, markup = SECTION_MARKUP }) => {
    const section = document.createElement("section");
    section.dataset.story = story;
    section.innerHTML = markup;
    root.append(section);
  });
  return root;
}

function refTo(root: HTMLElement | null): RefObject<HTMLElement | null> {
  return { current: root };
}

/** Renders the hook without a LandingMotion provider, so the policy stays pending. */
function renderPending(root: HTMLElement | null) {
  return renderHook(() => useSectionStories(refTo(root)));
}

function renderStories(policy: LandingMedia, root: HTMLElement | null) {
  const media = stubLandingMedia(policy);
  const wrapper = ({ children }: { children: ReactNode }) => <LandingMotion>{children}</LandingMotion>;
  return { ...renderHook(() => useSectionStories(refTo(root)), { wrapper }), media };
}

function selectorOf(call: Call) {
  const selector = SELECTORS.find((candidate) => call.elements[0].matches(candidate));
  if (!selector) throw new Error("tween target does not match any known selector");
  return selector;
}

/** Each tween as [method, targeted selector, ...tween arguments]. */
function steps(timeline: TimelineRecord): Step[] {
  return timeline.calls.map((call) => [call.method, selectorOf(call), ...call.args]);
}

/** Timelines are created per section in order: the reveal first, then the depth scrub. */
function sectionTimelines(index: number) {
  const [reveal, depth] = gsapState.timelines.slice(index * 2, index * 2 + 2) as TimelineRecord[];
  return { reveal, depth };
}

function revealVars(vars: TweenVars): TweenVars {
  return { ...vars, clearProps: CLEAR };
}

function wordOffset(call: Step, index: number) {
  const vars = call[2] as TweenVars;
  if (typeof vars.y !== "function") throw new Error("expected a per-element offset");
  return vars.y(index);
}

describe("useSectionStories", () => {
  beforeEach(() => {
    gsapState.timelines.length = 0;
    gsapState.context.mockReset();
    gsapState.revert.mockReset();
    gsapState.context.mockImplementation((callback: () => void) => {
      callback();
      return { revert: gsapState.revert };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("when it must stay static", () => {
    it("does nothing without a root", () => {
      renderStories("desktop", null);
      expect(gsapState.context).not.toHaveBeenCalled();
    });

    it("does nothing before the policy is known", () => {
      renderPending(buildRoot([{ story: "audience" }]));
      expect(gsapState.context).not.toHaveBeenCalled();
    });

    it("does nothing with reduced motion", () => {
      renderStories("reduced", buildRoot([{ story: "audience" }]));
      expect(gsapState.context).not.toHaveBeenCalled();
    });
  });

  describe("context lifecycle", () => {
    it("scopes one GSAP context to the root and builds two timelines per story section", () => {
      const root = buildRoot([{ story: "value" }, { story: "audience" }]);
      root.insertAdjacentHTML("beforeend", `<section>${SECTION_MARKUP}</section>`);
      renderStories("desktop", root);

      expect(gsapState.context).toHaveBeenCalledTimes(1);
      expect(gsapState.context.mock.calls[0][1]).toBe(root);
      expect(gsapState.timelines).toHaveLength(4);
    });

    it("reverts the context on unmount", () => {
      const { unmount } = renderStories("desktop", buildRoot([{ story: "audience" }]));
      expect(gsapState.revert).not.toHaveBeenCalled();

      unmount();
      expect(gsapState.revert).toHaveBeenCalledTimes(1);
    });

    it("reverts and rebuilds when the motion policy changes, and stops for reduced motion", () => {
      const { media } = renderStories("desktop", buildRoot([{ story: "audience" }]));

      media.change("mobile");
      expect(gsapState.revert).toHaveBeenCalledTimes(1);
      expect(gsapState.context).toHaveBeenCalledTimes(2);

      media.change("reduced");
      expect(gsapState.revert).toHaveBeenCalledTimes(2);
      expect(gsapState.context).toHaveBeenCalledTimes(2);
    });
  });

  describe("scroll triggers", () => {
    it("reveals regular sections once and scrubs their depth from 95% of the viewport", () => {
      renderStories("desktop", buildRoot([{ story: "audience" }]));

      const { reveal, depth } = sectionTimelines(0);
      expect(reveal.config.defaults).toEqual({ ease: "power3.out" });
      expect(reveal.config.scrollTrigger).toEqual({ trigger: expect.any(HTMLElement), start: TOP_80, once: true });
      expect(depth.config.defaults).toEqual({ ease: "none", duration: 1 });
      expect(depth.config.scrollTrigger).toEqual({
        trigger: expect.any(HTMLElement), start: "top 95%", end: BOTTOM_TOP, scrub: 0.6, invalidateOnRefresh: true,
      });
    });

    it("targets each section as its own trigger", () => {
      const root = buildRoot([{ story: "audience" }, { story: "company" }]);
      renderStories("desktop", root);

      const [first, second] = Array.from(root.querySelectorAll("section"));
      expect(sectionTimelines(0).reveal.config.scrollTrigger.trigger).toBe(first);
      expect(sectionTimelines(0).depth.config.scrollTrigger.trigger).toBe(first);
      expect(sectionTimelines(1).reveal.config.scrollTrigger.trigger).toBe(second);
      expect(sectionTimelines(1).depth.config.scrollTrigger.trigger).toBe(second);
    });

    it("replays the value section reveal when it is re-entered and starts its depth scrub earlier", () => {
      renderStories("desktop", buildRoot([{ story: "value" }]));

      const { reveal, depth } = sectionTimelines(0);
      expect(reveal.config.scrollTrigger).toEqual({
        trigger: expect.any(HTMLElement), start: TOP_80, end: BOTTOM_TOP, toggleActions: "restart reverse restart reverse",
      });
      expect(depth.config.scrollTrigger).toMatchObject({ start: "top bottom", end: BOTTOM_TOP, scrub: 0.6 });
    });
  });

  describe("desktop tweens", () => {
    it("reveals the headline, copy and decorative layers of an audience section", () => {
      renderStories("desktop", buildRoot([{ story: "audience" }]));

      const { reveal, depth } = sectionTimelines(0);
      const revealSteps = steps(reveal);
      expect(revealSteps.map(([, selector]) => selector)).toEqual([SEL.eyebrow, SEL.title, SEL.copy, SEL.preview, SEL.words, SEL.brand]);
      expect(revealSteps[0]).toEqual(["from", SEL.eyebrow, revealVars({ y: 24, autoAlpha: 0, duration: 0.55 }), 0]);
      expect(revealSteps[1]).toEqual(["from", SEL.title, revealVars({ y: 36, autoAlpha: 0, duration: 0.7 }), 0.06]);
      expect(revealSteps[2]).toEqual(["from", SEL.copy, revealVars({ y: 20, autoAlpha: 0, stagger: 0.08, duration: 0.55 }), 0.16]);
      expect(revealSteps[3]).toEqual(["from", SEL.preview, revealVars({ y: 40, autoAlpha: 0, duration: 0.7 }), 0.2]);
      expect(revealSteps[4].slice(0, 2)).toEqual(["from", SEL.words]);
      expect(revealSteps[4][2]).toEqual(revealVars({ y: expect.any(Function), autoAlpha: 0, stagger: 0.06, duration: 0.45 }));
      expect(revealSteps[4][3]).toBe(0.24);
      expect(revealSteps[5]).toEqual(["from", SEL.brand, revealVars({ autoAlpha: 0, duration: 0.55 }), 0.12]);
      expect(steps(depth)).toEqual([
        ["fromTo", SEL.continuity, { y: 90 }, { y: -90 }, 0],
        ["fromTo", SEL.valley, { y: -45 }, { y: 45 }, 0],
      ]);
    });

    it("targets every matching element and the copy paragraphs but not the eyebrow ones", () => {
      renderStories("desktop", buildRoot([{ story: "audience" }]));

      const calls = sectionTimelines(0).reveal.calls;
      const byTarget = (selector: string) => calls.find((call) => selectorOf(call) === selector)?.elements.map((element) => element.textContent);
      expect(byTarget(SEL.eyebrow)).toEqual(["Eyebrow", "Eyebrow"]);
      expect(byTarget(SEL.copy)).toEqual(["Texto do talento", "Texto do instituto"]);
      expect(byTarget(SEL.words)).toEqual(["a", "b", "c"]);
    });

    it("moves the headline further for the company section", () => {
      renderStories("desktop", buildRoot([{ story: "company" }]));

      expect(steps(sectionTimelines(0).reveal)[1]).toEqual(["from", SEL.title, revealVars({ y: 48, autoAlpha: 0, duration: 0.7 }), 0.06]);
    });

    it("builds the value section from its cover, title planes and grid instead of headline and copy", () => {
      renderStories("desktop", buildRoot([{ story: "value" }]));

      const { reveal, depth } = sectionTimelines(0);
      const revealSteps = steps(reveal);
      expect(revealSteps.map(([, selector]) => selector)).toEqual([SEL.eyebrow, SEL.plane, SEL.grid, SEL.preview, SEL.words, SEL.brand]);
      expect(revealSteps[1]).toEqual(["from", SEL.plane, revealVars({ y: 32, autoAlpha: 0, scale: 0.98, stagger: 0.08, duration: 0.7 }), 0.08]);
      expect(revealSteps[2]).toEqual(["from", SEL.grid, revealVars({ y: 32, autoAlpha: 0, stagger: 0.08, duration: 0.6 }), 0.24]);
      expect(steps(depth)).toEqual([
        ["from", SEL.cover, { y: 190, duration: 0.6 }, 0],
        ["fromTo", SEL.continuity, { y: 90 }, { y: -90 }, 0],
        ["fromTo", SEL.valley, { y: -45 }, { y: 45 }, 0],
      ]);
    });

    it("staggers the ecosystem words by an index-based offset", () => {
      renderStories("desktop", buildRoot([{ story: "audience" }]));

      const words = steps(sectionTimelines(0).reveal)[4];
      expect([0, 1, 2].map((index) => wordOffset(words, index))).toEqual([12, 16, 20]);
    });
  });

  describe("mobile tweens", () => {
    it("shortens offsets and durations and damps the depth on mobile", () => {
      renderStories("mobile", buildRoot([{ story: "company" }]));

      const { reveal, depth } = sectionTimelines(0);
      const revealSteps = steps(reveal);
      expect(revealSteps[0]).toEqual(["from", SEL.eyebrow, revealVars({ y: 15, autoAlpha: 0, duration: 0.45 }), 0]);
      expect(revealSteps[1]).toEqual(["from", SEL.title, revealVars({ y: 24, autoAlpha: 0, duration: 0.55 }), 0.06]);
      expect(revealSteps[2]).toEqual(["from", SEL.copy, revealVars({ y: 12, autoAlpha: 0, stagger: 0.08, duration: 0.45 }), 0.16]);
      expect(revealSteps[3]).toEqual(["from", SEL.preview, revealVars({ y: 24, autoAlpha: 0, duration: 0.55 }), 0.2]);
      expect(steps(depth)).toEqual([
        ["fromTo", SEL.continuity, { y: 90 * 0.3 }, { y: -90 * 0.3 }, 0],
        ["fromTo", SEL.valley, { y: -45 * 0.3 }, { y: 45 * 0.3 }, 0],
      ]);
      expect([0, 1, 2].map((index) => wordOffset(revealSteps[4], index))).toEqual([12 * 0.3, 16 * 0.3, 20 * 0.3]);
    });

    it("shortens the value section on mobile", () => {
      renderStories("mobile", buildRoot([{ story: "value" }]));

      const { reveal, depth } = sectionTimelines(0);
      const revealSteps = steps(reveal);
      expect(revealSteps[1]).toEqual(["from", SEL.plane, revealVars({ y: 24, autoAlpha: 0, scale: 0.98, stagger: 0.08, duration: 0.55 }), 0.08]);
      expect(revealSteps[2]).toEqual(["from", SEL.grid, revealVars({ y: 18, autoAlpha: 0, stagger: 0.08, duration: 0.45 }), 0.24]);
      expect(steps(depth)[0]).toEqual(["from", SEL.cover, { y: 70, duration: 0.6 }, 0]);
    });
  });

  describe("sections without the animated elements", () => {
    it("creates the timelines but no tweens", () => {
      renderStories("desktop", buildRoot([{ story: "audience", markup: "<p>Sem elementos animaveis</p>" }]));

      const { reveal, depth } = sectionTimelines(0);
      expect(reveal.calls).toEqual([]);
      expect(depth.calls).toEqual([]);
    });

    it("only animates the elements that exist", () => {
      renderStories("desktop", buildRoot([{ story: "audience", markup: '<h2>Titulo</h2><div class="valley-scene"></div>' }]));

      const { reveal, depth } = sectionTimelines(0);
      expect(steps(reveal).map(([, selector]) => selector)).toEqual([SEL.title]);
      expect(steps(depth).map(([, selector]) => selector)).toEqual([SEL.valley]);
    });

    it("skips the value cover depth when the value section has no cover", () => {
      renderStories("desktop", buildRoot([{ story: "value", markup: '<div class="story-continuity"></div>' }]));

      expect(steps(sectionTimelines(0).depth)).toEqual([["fromTo", SEL.continuity, { y: 90 }, { y: -90 }, 0]]);
    });

    it("ignores elements outside a data-story section", () => {
      const root = buildRoot([]);
      root.innerHTML = `<section>${SECTION_MARKUP}</section>`;
      renderStories("desktop", root);

      expect(gsapState.context).toHaveBeenCalledTimes(1);
      expect(gsapState.timelines).toHaveLength(0);
    });
  });
});
