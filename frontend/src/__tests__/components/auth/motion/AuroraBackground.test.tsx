import { ThemeProvider } from "@mui/material/styles";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmbientMotion } from "@/components/auth/motion/AmbientMotion";
import { AuroraBackground } from "@/components/auth/motion/AuroraBackground";
import { ease } from "@/components/auth/motion/tokens";
import { talentValleyTheme } from "@/theme/theme";
import { rulesOf } from "./injectedCss";
import { stubMotionMedia } from "./motionMedia";

const framer = vi.hoisted(() => ({ animate: vi.fn() }));

// Every call gets its own scope, as the real hook does, so each blob animates its own element.
vi.mock("framer-motion", async (importOriginal) => {
  const { useRef } = await import("react");
  return {
    ...(await importOriginal<typeof import("framer-motion")>()),
    useAnimate: () => [useRef(null), framer.animate],
  };
});

// Sides a blob is not anchored to.
const AUTO = "auto";

const FIRST_DRIFT = [
  "translate(0%, 0%) scale(1)",
  "translate(16%, 10%) scale(1.15)",
  "translate(-6%, 22%) scale(0.95)",
  "translate(0%, 0%) scale(1)",
];

function renderAurora(withAmbient: boolean) {
  const aurora = <AuroraBackground />;
  const { container } = render(
    <ThemeProvider theme={talentValleyTheme}>{withAmbient ? <AmbientMotion active>{aurora}</AmbientMotion> : aurora}</ThemeProvider>,
  );
  const root = container.firstElementChild as HTMLElement;
  return { root, blobs: Array.from(root.children) as HTMLElement[] };
}

beforeEach(() => {
  framer.animate.mockReset();
  framer.animate.mockReturnValue({ play: vi.fn(), pause: vi.fn(), cancel: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuroraBackground", () => {
  it("is a decorative, clipped layer that ignores the pointer", () => {
    const { root, blobs } = renderAurora(false);
    const style = getComputedStyle(root);
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(style.overflow).toBe("hidden");
    expect(style.pointerEvents).toBe("none");
    expect(blobs).toHaveLength(3);
  });

  it("places three blobs of different sizes in different corners", () => {
    const { blobs } = renderAurora(false);
    const layout = blobs.map((blob) => {
      const style = getComputedStyle(blob);
      return [style.width, style.top, style.bottom, style.left, style.right];
    });
    expect(layout).toEqual([
      ["75%", "-25%", AUTO, "-20%", AUTO],
      ["65%", AUTO, "-25%", AUTO, "-20%"],
      ["45%", "35%", AUTO, AUTO, "-10%"],
    ]);
  });

  it("tints the blobs with the primary and secondary colors, softer in the light scheme", () => {
    const { blobs } = renderAurora(false);
    const [first, second, third] = blobs.map((blob) => rulesOf(blob));
    expect(first).toContain("var(--mui-palette-primary-main) 24%");
    expect(first).toContain("var(--mui-palette-primary-main) 14%");
    expect(second).toContain("var(--mui-palette-secondary-main) 24%");
    expect(second).toContain("var(--mui-palette-secondary-main) 14%");
    expect(third).toContain("var(--mui-palette-primary-main) 24%");
  });

  it("stays still when the ambient loops are off", () => {
    renderAurora(false);
    expect(framer.animate).not.toHaveBeenCalled();
  });

  it("drifts each blob forever at its own pace when the ambient loops are on", () => {
    stubMotionMedia("pointer");
    const { blobs } = renderAurora(true);

    expect(framer.animate).toHaveBeenCalledTimes(3);
    const calls = framer.animate.mock.calls;
    expect(calls.map(([element]) => element)).toEqual(blobs);
    expect(calls.map(([, , options]) => options)).toEqual([
      { duration: 26, ease: ease.inOut, repeat: Infinity },
      { duration: 22, ease: ease.inOut, repeat: Infinity },
      { duration: 30, ease: ease.inOut, repeat: Infinity },
    ]);
    expect(calls[0][1]).toEqual({ transform: FIRST_DRIFT });
  });

  it("drifts every blob along a closed path made of transform steps", () => {
    stubMotionMedia("touch");
    renderAurora(true);

    for (const [, keyframes] of framer.animate.mock.calls) {
      const steps = keyframes.transform as string[];
      expect(steps).toHaveLength(4);
      expect(steps[0]).toBe(steps[3]);
      expect(steps.every((step) => /^translate\(-?\d+%, -?\d+%\) scale\([\d.]+\)$/.test(step))).toBe(true);
    }
  });
});

describe("AuroraBackground without CSS variables", () => {
  it("reads the colors straight from the theme palette", () => {
    const { container } = render(<AuroraBackground />);
    const blob = container.firstElementChild?.firstElementChild as HTMLElement;
    expect(rulesOf(blob)).toMatch(/color-mix\(in srgb, #[0-9a-f]{6} 14%, transparent\)/i);
  });
});
