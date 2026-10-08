import { render } from "@testing-library/react";
import { useReducedMotion } from "framer-motion";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckDraw } from "@/components/auth/motion/CheckDraw";
import { duration, ease } from "@/components/auth/motion/tokens";

interface PathProps {
  d: string;
  initial: unknown;
  animate: unknown;
  transition: unknown;
}

vi.mock("framer-motion", () => ({
  useReducedMotion: vi.fn(),
  motion: {
    path: ({ d, initial, animate, transition }: PathProps) => (
      <path d={d} data-initial={JSON.stringify(initial)} data-animate={JSON.stringify(animate)} data-transition={JSON.stringify(transition)} />
    ),
  },
}));

const HIDDEN = { pathLength: 0, opacity: 0 };
const SHOWN = { pathLength: 1, opacity: 1 };

function renderCheck(props: Parameters<typeof CheckDraw>[0] = {}) {
  const { container } = render(<CheckDraw {...props} />);
  const svg = container.querySelector("svg") as SVGSVGElement;
  const path = container.querySelector("path") as SVGPathElement;
  const data = (name: string) => JSON.parse(path.getAttribute(name) ?? "null");
  return { svg, container, data };
}

afterEach(() => {
  vi.mocked(useReducedMotion).mockReset();
});

describe("CheckDraw", () => {
  it("is a decorative 16px svg with a circle and a 2px stroke by default", () => {
    const { svg, container } = renderCheck();
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("height")).toBe("16");
    expect(svg.getAttribute("stroke-width")).toBe("2");
    expect(container.querySelector("circle")).not.toBeNull();
  });

  it("applies the size and stroke width", () => {
    const { svg } = renderCheck({ size: 64, strokeWidth: 1.6 });
    expect(svg.getAttribute("width")).toBe("64");
    expect(svg.getAttribute("height")).toBe("64");
    expect(svg.getAttribute("stroke-width")).toBe("1.6");
  });

  it("omits the circle when asked to", () => {
    expect(renderCheck({ circle: false }).container.querySelector("circle")).toBeNull();
  });

  it("starts hidden and draws the check when drawn", () => {
    const { data } = renderCheck({ drawn: true });
    expect(data("data-initial")).toEqual(HIDDEN);
    expect(data("data-animate")).toEqual(SHOWN);
  });

  it("wipes the check away when not drawn", () => {
    expect(renderCheck({ drawn: false }).data("data-animate")).toEqual(HIDDEN);
  });

  it("animates with the base duration and the outExpo curve", () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);
    expect(renderCheck().data("data-transition")).toEqual({ duration: duration.base, ease: ease.outExpo });
  });

  it("skips the animation time with reduced motion", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    expect(renderCheck().data("data-transition")).toEqual({ duration: 0 });
  });
});
