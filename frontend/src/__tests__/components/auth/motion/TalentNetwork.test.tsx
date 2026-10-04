import { ThemeProvider } from "@mui/material/styles";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmbientMotion } from "@/components/auth/motion/AmbientMotion";
import { TalentNetwork } from "@/components/auth/motion/TalentNetwork";
import { ease } from "@/components/auth/motion/tokens";
import { talentValleyTheme } from "@/theme/theme";
import { rulesOf } from "./injectedCss";
import { stubMotionMedia } from "./motionMedia";

const framer = vi.hoisted(() => ({ animate: vi.fn() }));

// Every call gets its own scope, as the real hook does, so each element animates on its own.
vi.mock("framer-motion", async (importOriginal) => {
  const { useRef } = await import("react");
  return {
    ...(await importOriginal<typeof import("framer-motion")>()),
    useAnimate: () => [useRef(null), framer.animate],
  };
});

const NODE_COUNT = 11;
const LINK_COUNT = 14;
const PULSE_COUNT = 5;
const LINK_SELECTOR = ".tv-net__link";
const NODE_SELECTOR = ".tv-net__node";
const PULSE_SELECTOR = ".tv-net__pulse";
const DASH_ATTRIBUTE = "stroke-dasharray";
const DRAWN = "1 1";
const NOT_DRAWN = "0 1";
const AUTO = "auto";
const CORNER = "translate(100%, 100%)";

function renderNetwork() {
  const { container } = render(
    <ThemeProvider theme={talentValleyTheme}>
      <AmbientMotion active>
        <TalentNetwork />
      </AmbientMotion>
    </ThemeProvider>,
  );
  const root = container.firstElementChild as HTMLElement;
  const all = (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector));
  return { root, all };
}

function animateCalls() {
  return framer.animate.mock.calls as [HTMLElement, Record<string, string[]>, Record<string, unknown>][];
}

beforeEach(() => {
  framer.animate.mockReset();
  framer.animate.mockReturnValue({ play: vi.fn(), pause: vi.fn(), cancel: vi.fn() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TalentNetwork structure", () => {
  it("is a decorative layer that ignores the pointer", () => {
    stubMotionMedia("pointer");
    const { root } = renderNetwork();
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(getComputedStyle(root).pointerEvents).toBe("none");
  });

  it("draws a link between the nodes of every pair", () => {
    stubMotionMedia("pointer");
    const { all } = renderNetwork();
    const links = all(LINK_SELECTOR).map((link) => link.getAttribute("d"));
    expect(links).toHaveLength(LINK_COUNT);
    expect(links[0]).toBe("M120 160L330 90");
    expect(links[LINK_COUNT - 1]).toBe("M700 470L880 800");
  });

  it("places the nodes in percent of the canvas, centered on their point", () => {
    stubMotionMedia("pointer");
    const { all } = renderNetwork();
    const nodes = all(NODE_SELECTOR);
    expect(nodes).toHaveLength(NODE_COUNT);

    const first = getComputedStyle(nodes[0]);
    expect([first.left, first.top, first.width, first.height, first.marginLeft, first.marginTop]).toEqual([
      "12%",
      "16%",
      "10px",
      "10px",
      "-5px",
      "-5px",
    ]);
    const last = getComputedStyle(nodes[NODE_COUNT - 1]);
    expect([last.left, last.top, last.width]).toEqual(["88%", "80%", "10px"]);
  });

  it("sizes each traveling pulse track like its link", () => {
    stubMotionMedia("pointer");
    const { all } = renderNetwork();
    const tracks = all(PULSE_SELECTOR).map((pulse) => getComputedStyle(pulse.parentElement as HTMLElement));
    expect(tracks).toHaveLength(PULSE_COUNT);

    // Link 1 runs from node 1 (330, 90) to node 2 (560, 190).
    expect([tracks[0].left, tracks[0].top, tracks[0].width, tracks[0].height]).toEqual(["33%", "9%", "23%", "10%"]);
  });

  it("sticks each pulse dot to the corner where its link starts", () => {
    stubMotionMedia("pointer");
    const { all } = renderNetwork();
    const dots = all(PULSE_SELECTOR).map((pulse) => getComputedStyle(pulse));
    const anchors = dots.map((dot) => [dot.left, dot.right, dot.top, dot.bottom]);

    expect(anchors[0]).toEqual(["-4px", AUTO, "-4px", AUTO]); // heads right and down
    expect(anchors[1]).toEqual([AUTO, "-4px", "-4px", AUTO]); // heads left and down
    expect(anchors[2]).toEqual(["-4px", AUTO, AUTO, "-4px"]); // heads right and up
  });

  it("colors links, nodes and pulses from the theme", () => {
    stubMotionMedia("pointer");
    const { root } = renderNetwork();
    const rules = rulesOf(root);
    expect(rules).toContain("stroke:var(--mui-palette-secondary-main)");
    expect(rules).toContain("background-color:var(--mui-palette-primary-main)");
  });
});

describe("TalentNetwork motion", () => {
  it("draws the links in from nothing when motion is allowed", () => {
    stubMotionMedia("pointer");
    const { all } = renderNetwork();
    expect(all(LINK_SELECTOR).every((link) => link.getAttribute(DASH_ATTRIBUTE) === NOT_DRAWN)).toBe(true);
  });

  it("shows the links already drawn, with no loops, with reduced motion", () => {
    stubMotionMedia("reduced");
    const { all } = renderNetwork();
    expect(all(LINK_SELECTOR).every((link) => link.getAttribute(DASH_ATTRIBUTE) === DRAWN)).toBe(true);
    expect(framer.animate).not.toHaveBeenCalled();
  });

  it("redraws the links when motion becomes allowed", () => {
    const media = stubMotionMedia("reduced");
    const { all } = renderNetwork();
    const staticLink = all(LINK_SELECTOR)[0];

    media.change("pointer");
    const liveLink = all(LINK_SELECTOR)[0];
    expect(liveLink).not.toBe(staticLink);
    expect(liveLink.getAttribute(DASH_ATTRIBUTE)).toBe(NOT_DRAWN);
  });

  it("pulses every node and sends a pulse along five links", () => {
    stubMotionMedia("pointer");
    renderNetwork();
    expect(framer.animate).toHaveBeenCalledTimes(NODE_COUNT + PULSE_COUNT);
  });

  it("keeps the nodes out of phase with different periods and offsets", () => {
    stubMotionMedia("pointer");
    const { all } = renderNetwork();
    const calls = animateCalls();
    const nodeCalls = calls.slice(0, NODE_COUNT);

    expect(nodeCalls.map(([element]) => element)).toEqual(all(`${NODE_SELECTOR} > span`));
    expect(nodeCalls[0][1]).toEqual({ transform: ["scale(1)", "scale(1.8)", "scale(1)"], opacity: [0.7, 1, 0.7] });
    expect(nodeCalls.map(([, , options]) => options.duration)).toEqual([3, 3.5, 4, 4.5, 3, 3.5, 4, 4.5, 3, 3.5, 4]);
    expect(nodeCalls[1][2]).toMatchObject({ ease: ease.inOut, repeat: Infinity });
    expect(nodeCalls[1][2].delay).toBeCloseTo(0.7);
    expect(nodeCalls[5][2].delay).toBeCloseTo(0.5);
    expect(nodeCalls[3][2].delay).toBeCloseTo(2.1);
  });

  it("makes each pulse travel its link once per period, then rest", () => {
    stubMotionMedia("pointer");
    const { all } = renderNetwork();
    const pulseCalls = animateCalls().slice(NODE_COUNT);

    expect(pulseCalls.map(([element]) => element)).toEqual(all(PULSE_SELECTOR).map((pulse) => pulse.parentElement));
    expect(pulseCalls.map(([, , options]) => options.delay)).toEqual([0, 1.4, 2.6, 0.8, 3.4]);
    for (const [, , options] of pulseCalls) {
      expect(options).toMatchObject({ duration: 6.6, ease: "linear", times: [0, 0.015, 0.36, 0.39, 1], repeat: Infinity });
    }
    for (const [, keyframes] of pulseCalls) {
      expect(keyframes.opacity).toEqual([0, 1, 1, 0, 0]);
    }
  });

  it("moves each pulse toward the node its link ends at", () => {
    stubMotionMedia("pointer");
    renderNetwork();
    const ends = animateCalls()
      .slice(NODE_COUNT)
      .map(([, keyframes]) => keyframes.transform[2]);

    expect(ends).toEqual([
      CORNER,
      "translate(-100%, 100%)",
      "translate(100%, -100%)",
      CORNER,
      CORNER,
    ]);
    const first = animateCalls()[NODE_COUNT][1].transform;
    expect(first).toEqual(["translate(0, 0)", "translate(0, 0)", ends[0], ends[0], ends[0]]);
  });
});

describe("TalentNetwork without CSS variables", () => {
  it("reads the colors straight from the theme palette", () => {
    stubMotionMedia("pointer");
    const { container } = render(<TalentNetwork />);
    expect(rulesOf(container.firstElementChild as Element)).toMatch(/background-color:#[0-9a-f]{6}/i);
  });
});
