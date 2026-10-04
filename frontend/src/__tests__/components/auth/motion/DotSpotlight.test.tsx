import { act, render, waitFor } from "@testing-library/react";
import { useMotionValue } from "framer-motion";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DotSpotlight } from "@/components/auth/motion/DotSpotlight";

// Half the spotlight diameter (RADIUS in DotSpotlight).
const RADIUS = 170;

const observers: { callback: () => void; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];

class FakeResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(callback: () => void) {
    observers.push({ callback, observe: this.observe, disconnect: this.disconnect });
  }
}

function Harness({ spotX, spotY, presence }: { spotX: number; spotY: number; presence: number }) {
  const pointer = {
    x: useMotionValue(0),
    y: useMotionValue(0),
    spotX: useMotionValue(spotX),
    spotY: useMotionValue(spotY),
    presence: useMotionValue(presence),
  };
  return <DotSpotlight pointer={pointer} />;
}

function renderSpotlight(spotX = 0.5, spotY = 0.5, presence = 0) {
  const { container, unmount } = render(<Harness spotX={spotX} spotY={spotY} presence={presence} />);
  const root = container.firstElementChild as HTMLElement;
  const mask = root.children[1] as HTMLElement;
  const grid = mask.firstElementChild as HTMLElement;
  return { root, mask, grid, unmount };
}

function resize(root: HTMLElement, width: number, height: number) {
  Object.defineProperty(root, "clientWidth", { configurable: true, value: width });
  Object.defineProperty(root, "clientHeight", { configurable: true, value: height });
  act(() => observers[0].callback());
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DotSpotlight", () => {
  it("is a decorative layer with a quiet grid and a masked lit grid", () => {
    const { root, mask } = renderSpotlight();
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.children).toHaveLength(2);
    expect(getComputedStyle(mask).width).toBe(`${RADIUS * 2}px`);
    expect(getComputedStyle(mask).height).toBe(`${RADIUS * 2}px`);
  });

  it("observes the size of its root", () => {
    const { root } = renderSpotlight();
    expect(observers).toHaveLength(1);
    expect(observers[0].observe).toHaveBeenCalledWith(root);
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = renderSpotlight();
    expect(observers[0].disconnect).not.toHaveBeenCalled();

    unmount();
    expect(observers[0].disconnect).toHaveBeenCalledTimes(1);
  });

  it("centers the mask on the spot and moves the lit grid the opposite way", async () => {
    const { root, mask, grid } = renderSpotlight(0.5, 0.25, 0.6);

    resize(root, 400, 200);
    // Spot at (200, 50): the mask box sits at (200 - 170, 50 - 170) and the grid offsets it back.
    await waitFor(() => expect(mask.style.transform).toBe("translateX(30px) translateY(-120px)"));
    expect(grid.style.transform).toBe("translateX(-30px) translateY(120px)");
  });

  it("sizes the lit grid like the root, so its dots line up with the quiet ones", async () => {
    const { root, grid } = renderSpotlight();

    resize(root, 400, 200);
    await waitFor(() => expect(grid.style.width).toBe("400px"));
    expect(grid.style.height).toBe("200px");
  });

  it("shows the spotlight according to the pointer presence", async () => {
    const { mask } = renderSpotlight(0.5, 0.5, 0.6);
    await waitFor(() => expect(mask.style.opacity).toBe("0.6"));
  });
});
