import { render, waitFor } from "@testing-library/react";
import { motionValue } from "framer-motion";
import { describe, expect, it } from "vitest";
import { LoginVisualScene } from "@/components/auth/LoginVisualScene";

function makePointer() {
  return {
    x: motionValue(0),
    y: motionValue(0),
    spotX: motionValue(0.5),
    spotY: motionValue(0.5),
    presence: motionValue(0),
  };
}

function layer(container: HTMLElement, name: string) {
  return container.querySelector(`.tv-scene__${name}`) as SVGGElement;
}

function translation(element: SVGGElement) {
  const match = /translateX\(([-\d.]+)px\) translateY\(([-\d.]+)px\)/.exec(element.style.transform);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
}

describe("LoginVisualScene", () => {
  it("is a decorative, non-interactive terrain with the mountain, network and nodes", () => {
    const { container } = render(<LoginVisualScene pointer={makePointer()} />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(getComputedStyle(root).pointerEvents).toBe("none");
    expect(root.querySelector("svg")?.getAttribute("focusable")).toBe("false");
    expect(layer(container, "contours").querySelectorAll("path")).toHaveLength(6);
    expect(layer(container, "mountain").querySelectorAll("path").length).toBeGreaterThan(0);
    expect(layer(container, "network").querySelectorAll("path")).toHaveLength(2);
    expect(layer(container, "nodes").querySelectorAll("circle")).toHaveLength(5);
  });

  it("keeps the layers still while the pointer is at rest", () => {
    const { container } = render(<LoginVisualScene pointer={makePointer()} />);

    expect(translation(layer(container, "contours"))).toBeNull();
    expect(translation(layer(container, "mountain"))).toBeNull();
    expect(translation(layer(container, "nodes"))).toBeNull();
  });

  it("shifts each depth layer by a different amount as the pointer moves", async () => {
    const pointer = makePointer();
    const { container } = render(<LoginVisualScene pointer={pointer} />);

    pointer.x.set(0.5);
    pointer.y.set(-0.5);

    await waitFor(() => expect(translation(layer(container, "contours"))).not.toBeNull());
    const far = translation(layer(container, "contours"));
    const mid = translation(layer(container, "mountain"));
    const near = translation(layer(container, "nodes"));
    expect(far).toEqual({ x: 12, y: -12 });
    expect(mid?.x).toBeCloseTo((0.5 * 44) / 7.7);
    expect(mid?.y).toBeCloseTo((-0.5 * 44) / 7.7);
    expect(near?.x).toBeCloseTo((0.5 * 76) / 7.7);
    expect(near?.y).toBeCloseTo((-0.5 * 76) / 7.7);
  });

  it("moves the network together with the nodes", async () => {
    const pointer = makePointer();
    const { container } = render(<LoginVisualScene pointer={pointer} />);

    pointer.x.set(-0.25);
    pointer.y.set(0.25);

    await waitFor(() => expect(translation(layer(container, "network"))).not.toBeNull());
    expect(translation(layer(container, "network"))).toEqual(translation(layer(container, "nodes")));
  });
});
