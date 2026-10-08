import type { ReactNode, RefObject } from "react";
import { fireEvent, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingMotion, motionQueries } from "@/components/landing/motion/LandingMotion";
import { useHeroDepth } from "@/components/landing/motion/useHeroDepth";
import { stubLandingMedia, type LandingMedia } from "./landingMedia";

type Conditions = { motion?: boolean; pointer?: boolean } | undefined;
type Tween = [string, Record<string, number>, number];
type TimelineConfig = { defaults: object; scrollTrigger: Record<string, unknown> };
type MatchMediaCallback = (context: { conditions: Conditions }) => (() => void) | void;

const gsapState = vi.hoisted(() => ({
  conditions: undefined as { motion?: boolean; pointer?: boolean } | undefined,
  matchMedia: vi.fn(),
  add: vi.fn(),
  revert: vi.fn(),
  timelines: [] as { config: unknown; tweens: [string, Record<string, number>, number][] }[],
  quickTo: [] as { target: Element; prop: string; vars: unknown; setter: ReturnType<typeof vi.fn> }[],
}));

vi.mock("@/components/landing/motion/scrollTriggerSetup", () => ({}));
vi.mock("gsap", () => {
  const timeline = (config: unknown) => {
    const record = { config, tweens: [] as [string, Record<string, number>, number][] };
    gsapState.timelines.push(record);
    const chain = {
      to(selector: string, vars: Record<string, number>, position: number) {
        record.tweens.push([selector, vars, position]);
        return chain;
      },
    };
    return chain;
  };
  const quickTo = (target: Element, prop: string, vars: unknown) => {
    const setter = vi.fn();
    gsapState.quickTo.push({ target, prop, vars, setter });
    return setter;
  };
  return { gsap: { matchMedia: () => gsapState.matchMedia(), timeline, quickTo } };
});

const HERO_BACKGROUND = ".hero-background";
const TECHNOLOGY_CLASS = "hero-technology-depth";
const HERO_TECHNOLOGY_DEPTH = `.${TECHNOLOGY_CLASS}`;
const ATMOSPHERE = ".hero-atmosphere";
const MOUSE = "mouse";

function buildRoot(withHero = true, layers: string[] = [HERO_BACKGROUND, HERO_TECHNOLOGY_DEPTH]) {
  const root = document.createElement("main");
  if (!withHero) return root;
  const hero = document.createElement("section");
  hero.className = "hero";
  layers.forEach((selector) => {
    const layer = document.createElement("div");
    layer.className = selector.slice(1);
    hero.append(layer);
  });
  root.append(hero);
  return root;
}

function heroOf(root: HTMLElement) {
  const hero = root.querySelector<HTMLElement>(".hero");
  if (!hero) throw new Error("hero missing");
  return hero;
}

function refTo(root: HTMLElement | null): RefObject<HTMLElement | null> {
  return { current: root };
}

/** Renders the hook without a LandingMotion provider, so the policy stays pending. */
function renderPending(root: HTMLElement | null) {
  return renderHook(() => useHeroDepth(refTo(root)));
}

function renderDepth(policy: LandingMedia, root: HTMLElement | null) {
  const media = stubLandingMedia(policy);
  const wrapper = ({ children }: { children: ReactNode }) => <LandingMotion>{children}</LandingMotion>;
  return { ...renderHook(() => useHeroDepth(refTo(root)), { wrapper }), media };
}

function scrollTween(selector: string) {
  const tween = gsapState.timelines[0].tweens.find(([target]) => target === selector);
  if (!tween) throw new Error(`no tween for ${selector}`);
  return tween;
}

function setterFor(selector: string, prop: string) {
  const entry = gsapState.quickTo.find(({ target, prop: name }) => target.matches(selector) && name === prop);
  if (!entry) throw new Error(`no quickTo for ${selector} ${prop}`);
  return entry.setter;
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: height, configurable: true });
}

describe("useHeroDepth", () => {
  beforeEach(() => {
    gsapState.conditions = { motion: true, pointer: true };
    gsapState.timelines.length = 0;
    gsapState.quickTo.length = 0;
    gsapState.matchMedia.mockReset();
    gsapState.add.mockReset();
    gsapState.revert.mockReset();
    let cleanup: (() => void) | void;
    gsapState.add.mockImplementation((_conditions: unknown, callback: MatchMediaCallback) => {
      cleanup = callback({ conditions: gsapState.conditions });
    });
    gsapState.revert.mockImplementation(() => cleanup?.());
    gsapState.matchMedia.mockImplementation(() => ({ add: gsapState.add, revert: gsapState.revert }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, "maxTouchPoints");
    Reflect.deleteProperty(window, "innerWidth");
    Reflect.deleteProperty(window, "innerHeight");
  });

  describe("when it must stay static", () => {
    it("does nothing without a landing root", () => {
      renderDepth("desktop", null);
      expect(gsapState.matchMedia).not.toHaveBeenCalled();
    });

    it("does nothing when the root has no hero", () => {
      renderDepth("desktop", buildRoot(false));
      expect(gsapState.matchMedia).not.toHaveBeenCalled();
    });

    it("does not create GSAP animations before the policy is known", () => {
      renderPending(buildRoot());
      expect(gsapState.matchMedia).not.toHaveBeenCalled();
    });

    it("does not create GSAP animations with reduced motion", () => {
      renderDepth("reduced", buildRoot());
      expect(gsapState.matchMedia).not.toHaveBeenCalled();
    });
  });

  describe("scroll depth", () => {
    it("scopes a GSAP matchMedia to the hero for motion-capable, fine-pointer environments", () => {
      const root = buildRoot();
      renderDepth("desktop", root);

      expect(gsapState.matchMedia).toHaveBeenCalledTimes(1);
      expect(gsapState.add).toHaveBeenCalledTimes(1);
      const [conditions, , scope] = gsapState.add.mock.calls[0];
      expect(conditions).toEqual({ motion: "(prefers-reduced-motion: no-preference)", pointer: motionQueries.pointer });
      expect(scope).toBe(heroOf(root));
    });

    it("scrubs a hero timeline at full distance on desktop", () => {
      const root = buildRoot();
      renderDepth("desktop", root);

      expect(gsapState.timelines).toHaveLength(1);
      const config = gsapState.timelines[0].config as TimelineConfig;
      expect(config.defaults).toEqual({ ease: "none", duration: 1 });
      expect(config.scrollTrigger).toEqual({ trigger: heroOf(root), start: "top top", end: "bottom top", scrub: true, invalidateOnRefresh: true });
      expect(gsapState.timelines[0].tweens).toEqual<Tween[]>([
        [".hero-background-scroll", { y: 40 }, 0],
        [ATMOSPHERE, { y: -100, x: 45 }, 0],
        [".hero-technology", { y: -70 }, 0],
        [".hero-headline-scroll", { y: -230, opacity: 0, duration: 0.65 }, 0],
        [".hero-subtitle-scroll", { y: -140, opacity: 0, duration: 0.55 }, 0.08],
        [".hero-institutional-scroll", { y: -90, opacity: 0, duration: 0.5 }, 0.12],
        [".hero-actions-scroll", { y: -60, opacity: 0, duration: 0.4 }, 0.22],
        [".explore-link", { y: 75, opacity: 0, duration: 0.22 }, 0],
        [".hero-exit-shade", { opacity: 1 }, 0],
      ]);
    });

    it("shortens every travel distance to 32% on mobile", () => {
      renderDepth("mobile", buildRoot());

      expect(scrollTween(".hero-background-scroll")[1].y).toBeCloseTo(12.8);
      expect(scrollTween(ATMOSPHERE)[1].y).toBeCloseTo(-32);
      expect(scrollTween(ATMOSPHERE)[1].x).toBeCloseTo(14.4);
      expect(scrollTween(".hero-technology")[1].y).toBeCloseTo(-22.4);
      expect(scrollTween(".hero-headline-scroll")[1].y).toBeCloseTo(-73.6);
      expect(scrollTween(".hero-subtitle-scroll")[1].y).toBeCloseTo(-44.8);
      expect(scrollTween(".hero-institutional-scroll")[1].y).toBeCloseTo(-28.8);
      expect(scrollTween(".hero-actions-scroll")[1].y).toBeCloseTo(-19.2);
      expect(scrollTween(".explore-link")[1].y).toBeCloseTo(24);
    });

    it("creates nothing when GSAP reports reduced motion", () => {
      gsapState.conditions = { motion: false, pointer: true };
      renderDepth("desktop", buildRoot());

      expect(gsapState.add).toHaveBeenCalledTimes(1);
      expect(gsapState.timelines).toHaveLength(0);
      expect(gsapState.quickTo).toHaveLength(0);
    });

    it("creates nothing when GSAP reports no conditions", () => {
      gsapState.conditions = undefined;
      renderDepth("desktop", buildRoot());

      expect(gsapState.add).toHaveBeenCalledTimes(1);
      expect(gsapState.timelines).toHaveLength(0);
      expect(gsapState.quickTo).toHaveLength(0);
    });

    it("reverts the GSAP matchMedia on unmount", () => {
      const { unmount } = renderDepth("desktop", buildRoot());
      expect(gsapState.revert).not.toHaveBeenCalled();

      unmount();
      expect(gsapState.revert).toHaveBeenCalledTimes(1);
    });

    it("reverts and rebuilds when the motion policy changes", () => {
      const { media } = renderDepth("desktop", buildRoot());

      media.change("mobile");
      expect(gsapState.revert).toHaveBeenCalledTimes(1);
      expect(gsapState.matchMedia).toHaveBeenCalledTimes(2);
      expect(gsapState.timelines).toHaveLength(2);

      media.change("reduced");
      expect(gsapState.revert).toHaveBeenCalledTimes(2);
      expect(gsapState.matchMedia).toHaveBeenCalledTimes(2);
    });
  });

  describe("pointer depth", () => {
    it("skips pointer depth without a fine pointer", () => {
      gsapState.conditions = { motion: true, pointer: false };
      renderDepth("desktop", buildRoot());

      expect(gsapState.timelines).toHaveLength(1);
      expect(gsapState.quickTo).toHaveLength(0);
    });

    it("skips pointer depth on touch devices", () => {
      Object.defineProperty(navigator, "maxTouchPoints", { value: 5, configurable: true });
      renderDepth("desktop", buildRoot());

      expect(gsapState.timelines).toHaveLength(1);
      expect(gsapState.quickTo).toHaveLength(0);
    });

    it("creates x/y quickTo setters for the background and technology layers", () => {
      renderDepth("desktop", buildRoot());

      expect(gsapState.quickTo.map(({ target, prop }) => [target.className, prop])).toEqual([
        ["hero-background", "x"], ["hero-background", "y"], [TECHNOLOGY_CLASS, "x"], [TECHNOLOGY_CLASS, "y"],
      ]);
      expect(gsapState.quickTo).toHaveLength(4);
      gsapState.quickTo.forEach(({ vars }) => expect(vars).toEqual({ duration: 0.7, ease: "power3.out" }));
    });

    it("ignores layers that are not in the hero", () => {
      renderDepth("desktop", buildRoot(true, [HERO_TECHNOLOGY_DEPTH]));

      expect(gsapState.quickTo.map(({ target }) => target.className)).toEqual([TECHNOLOGY_CLASS, TECHNOLOGY_CLASS]);
    });

    it("moves the layers by their depth with the mouse, relative to the viewport centre", () => {
      setViewport(1000, 500);
      const root = buildRoot();
      renderDepth("desktop", root);

      fireEvent.pointerMove(heroOf(root), { pointerType: MOUSE, clientX: 750, clientY: 100 });

      expect(setterFor(HERO_BACKGROUND, "x")).toHaveBeenLastCalledWith(0.5 * 20);
      expect(setterFor(HERO_BACKGROUND, "y")).toHaveBeenLastCalledWith(-0.6 * 20);
      expect(setterFor(HERO_TECHNOLOGY_DEPTH, "x")).toHaveBeenLastCalledWith(0.5 * -36);
      expect(setterFor(HERO_TECHNOLOGY_DEPTH, "y")).toHaveBeenLastCalledWith(-0.6 * -36);
    });

    it("ignores touch and pen pointers", () => {
      const root = buildRoot();
      renderDepth("desktop", root);

      fireEvent.pointerMove(heroOf(root), { pointerType: "touch", clientX: 10, clientY: 10 });
      fireEvent.pointerMove(heroOf(root), { pointerType: "pen", clientX: 10, clientY: 10 });

      expect(gsapState.quickTo).toHaveLength(4);

      gsapState.quickTo.forEach(({ setter }) => expect(setter).not.toHaveBeenCalled());
    });

    it("re-reads the viewport size on resize", () => {
      setViewport(1000, 500);
      const root = buildRoot();
      renderDepth("desktop", root);

      setViewport(2000, 1000);
      fireEvent(window, new Event("resize"));
      fireEvent.pointerMove(heroOf(root), { pointerType: MOUSE, clientX: 1500, clientY: 250 });

      expect(setterFor(HERO_BACKGROUND, "x")).toHaveBeenLastCalledWith(0.5 * 20);
      expect(setterFor(HERO_BACKGROUND, "y")).toHaveBeenLastCalledWith(-0.5 * 20);
    });

    it("eases the layers back to rest when the pointer leaves the hero", () => {
      setViewport(1000, 500);
      const root = buildRoot();
      renderDepth("desktop", root);
      fireEvent.pointerMove(heroOf(root), { pointerType: MOUSE, clientX: 900, clientY: 400 });
      expect(setterFor(HERO_BACKGROUND, "x")).toHaveBeenLastCalledWith(0.8 * 20);

      fireEvent.pointerLeave(heroOf(root));

      expect(gsapState.quickTo).toHaveLength(4);

      gsapState.quickTo.forEach(({ setter }) => expect(setter).toHaveBeenLastCalledWith(0));
    });

    it("removes its listeners when reverted", () => {
      const root = buildRoot();
      const hero = heroOf(root);
      const { unmount } = renderDepth("desktop", root);
      const removeWindowListener = vi.spyOn(window, "removeEventListener");

      unmount();
      fireEvent.pointerMove(hero, { pointerType: MOUSE, clientX: 900, clientY: 400 });
      fireEvent.pointerLeave(hero);

      expect(gsapState.quickTo).toHaveLength(4);

      gsapState.quickTo.forEach(({ setter }) => expect(setter).not.toHaveBeenCalled());
      expect(removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));
    });
  });
});
