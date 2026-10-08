import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SuccessMark } from "@/components/auth/motion/SuccessMark";
import { stubMotionMedia } from "./motionMedia";

function renderMark(policy: Parameters<typeof stubMotionMedia>[0]) {
  stubMotionMedia(policy);
  const { container } = render(<SuccessMark />);
  const root = container.firstElementChild as HTMLElement;
  const particles = Array.from(root.querySelectorAll<HTMLElement>("span"));
  return { root, particles };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SuccessMark", () => {
  it("is a decorative badge holding the check", () => {
    const { root } = renderMark("pointer");
    expect(root.getAttribute("aria-hidden")).toBe("true");

    const check = root.querySelector("svg");
    expect(check?.getAttribute("width")).toBe("64");
    expect(check?.getAttribute("stroke-width")).toBe("1.6");
    expect(check?.querySelector("circle")).not.toBeNull();
  });

  it.each(["pointer", "touch"] as const)("lets ten specks drift out of it on %s", (policy) => {
    const { particles } = renderMark(policy);
    expect(particles).toHaveLength(10);
  });

  it("alternates big and small specks", () => {
    const { particles } = renderMark("pointer");
    const sizes = particles.map((particle) => particle.style.width);
    expect(sizes).toEqual(["6px", "4px", "6px", "4px", "6px", "4px", "6px", "4px", "6px", "4px"]);
  });

  it("starts every speck invisible and small, at the center", () => {
    const { particles } = renderMark("pointer");
    for (const particle of particles) {
      expect(particle.style.opacity).toBe("0");
      expect(particle.style.transform).toBe("translate(0px, 0px) scale(0.4)");
    }
  });

  it("shows no specks with reduced motion", () => {
    const { root, particles } = renderMark("reduced");
    expect(particles).toHaveLength(0);
    expect(root.querySelector("svg")).not.toBeNull();
  });
});
