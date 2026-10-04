import { Box } from "@mui/material";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PulseRing, shimmerSx } from "@/components/auth/motion/buttonEffects";
import { injectedCss } from "./injectedCss";

function renderRing(props: Parameters<typeof PulseRing>[0] = {}) {
  const { container } = render(<PulseRing {...props} />);
  return container.firstElementChild as HTMLElement;
}

function animationOf(element: HTMLElement) {
  return getComputedStyle(element).animation;
}

describe("shimmerSx", () => {
  function shimmerCss() {
    render(<Box sx={shimmerSx} />);
    return injectedCss();
  }

  it("draws a band of light over the button that stays hidden at rest", () => {
    const css = shimmerCss();
    expect(css).toMatch(/::before\{content:"";position:absolute;[^}]*pointer-events:none;opacity:0;/);
    expect(css).toContain("linear-gradient(110deg");
  });

  it("sweeps the band once on hover, except on a disabled button", () => {
    const css = shimmerCss();
    expect(css).toMatch(/:hover:not\(\.Mui-disabled\)::before\{opacity:1;[^}]*animation:animation-\w+ 700ms ease-out;/);
    expect(css).toMatch(/@keyframes animation-\w+\{from\{[^}]*background-position:130% 0;\}to\{[^}]*background-position:-30% 0;/);
  });

  it("hides the band with reduced motion", () => {
    expect(shimmerCss()).toMatch(/@media \(prefers-reduced-motion: reduce\)\{[^}]*::before\{display:none;\}/);
  });
});

describe("PulseRing", () => {
  it("is a decorative span", () => {
    const ring = renderRing();
    expect(ring.tagName).toBe("SPAN");
    expect(ring.getAttribute("aria-hidden")).toBe("true");
  });

  it("plays once with no delay by default", () => {
    expect(animationOf(renderRing())).toMatch(/^animation-\w+ 1\.4s ease-out 0s 1 backwards$/);
  });

  it("uses the given iterations and delay", () => {
    expect(animationOf(renderRing({ iterations: 3, delay: 0.5 }))).toMatch(/ 1\.4s ease-out 0\.5s 3 backwards$/);
  });

  it("is hidden with reduced motion", () => {
    renderRing();
    expect(injectedCss()).toMatch(/@media \(prefers-reduced-motion: reduce\)\{\.css-\w+\{display:none;\}\}/);
  });
});
