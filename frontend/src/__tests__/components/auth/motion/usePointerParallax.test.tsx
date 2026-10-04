import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePointerParallax } from "@/components/auth/motion/usePointerParallax";
import { stubMotionMedia } from "./motionMedia";

// Springs are replaced by their source value so the pointer math can be read back synchronously.
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useSpring: <T,>(source: T) => source,
}));

const RECT = { x: 100, y: 50, width: 200, height: 100 };

function createElement() {
  const element = document.createElement("div");
  vi.spyOn(element, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect(RECT));
  return element;
}

function setup(policy: Parameters<typeof stubMotionMedia>[0], element: HTMLElement | null = createElement()) {
  const media = stubMotionMedia(policy);
  const ref = { current: element };
  const hook = renderHook(() => usePointerParallax(ref));
  return { media, element, ...hook };
}

function pointerAt(element: HTMLElement | null, type: string, clientX = 0, clientY = 0) {
  element?.dispatchEvent(new PointerEvent(type, { clientX, clientY }));
}

function values(result: { current: ReturnType<typeof usePointerParallax> }) {
  const { x, y, spotX, spotY, presence } = result.current;
  return { x: x.get(), y: y.get(), spotX: spotX.get(), spotY: spotY.get(), presence: presence.get() };
}

const AT_REST = { x: 0, y: 0, spotX: 0.5, spotY: 0.5, presence: 0 };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("usePointerParallax", () => {
  it("starts at rest", () => {
    const { result } = setup("pointer");
    expect(values(result)).toEqual(AT_REST);
  });

  it("tracks the pointer relative to the element on a fine pointer", () => {
    const { result, element } = setup("pointer");

    pointerAt(element, "pointermove", 150, 75);
    expect(values(result)).toEqual({ x: -0.25, y: -0.25, spotX: 0.25, spotY: 0.25, presence: 1 });

    pointerAt(element, "pointermove", 250, 100);
    expect(values(result)).toEqual({ x: 0.25, y: 0, spotX: 0.75, spotY: 0.5, presence: 1 });
  });

  it("eases the parallax back and hides the spotlight, keeping its position, when the pointer leaves", () => {
    const { result, element } = setup("pointer");
    pointerAt(element, "pointermove", 150, 75);

    pointerAt(element, "pointerleave");
    expect(values(result)).toEqual({ x: 0, y: 0, spotX: 0.25, spotY: 0.25, presence: 0 });
  });

  it.each(["touch", "reduced"] as const)("ignores the pointer on %s", (policy) => {
    const { result, element } = setup(policy);

    pointerAt(element, "pointermove", 150, 75);
    expect(values(result)).toEqual(AT_REST);
  });

  it("does nothing without an element", () => {
    const { result } = setup("pointer", null);
    expect(values(result)).toEqual(AT_REST);
  });

  it("stops tracking and returns to rest on unmount", () => {
    const { result, element, unmount } = setup("pointer");
    pointerAt(element, "pointermove", 150, 75);

    unmount();
    expect(values(result)).toMatchObject({ x: 0, y: 0, presence: 0 });

    pointerAt(element, "pointermove", 250, 100);
    expect(values(result)).toMatchObject({ x: 0, y: 0, presence: 0 });
  });

  it("stops tracking when the policy stops being pointer", () => {
    const { result, element, media } = setup("pointer");

    media.change("touch");
    pointerAt(element, "pointermove", 150, 75);
    expect(values(result)).toEqual(AT_REST);
  });
});
