import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SceneConnections, SceneContours, ValleyScene } from "@/components/landing/ValleyScene";

const LAYER = "data-scene-layer";
const CONTOUR_PATHS = `[${LAYER}="contours"] path`;
const CONNECTION_PATHS = `[${LAYER}="connections"] path`;

function renderScene(element: ReactElement) {
  const { container } = render(element);
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("svg not rendered");
  return svg;
}

function renderInSvg(element: ReactElement) {
  return renderScene(<svg>{element}</svg>);
}

describe("ValleyScene", () => {
  it("is purely decorative: hidden from assistive tech and never focusable", () => {
    const svg = renderScene(<ValleyScene />);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.querySelectorAll("title, desc")).toHaveLength(0);
  });

  it("draws every artwork layer", () => {
    const svg = renderScene(<ValleyScene />);
    const layers = [...svg.querySelectorAll(`[${LAYER}]`)].map((layer) => layer.getAttribute(LAYER));
    expect(layers).toEqual(["distant", "facets", "mesh", "contours", "river", "connections"]);
  });

  it("uses the full-size scene by default and the compact one on request", () => {
    const full = renderScene(<ValleyScene />);
    expect(full.getAttribute("class")).toBe("valley-scene");
    expect(full.querySelectorAll(CONTOUR_PATHS)).toHaveLength(24);

    const compact = renderScene(<ValleyScene compact />);
    expect(compact.getAttribute("class")).toBe("valley-scene compact");
    expect(compact.querySelectorAll(CONTOUR_PATHS)).toHaveLength(13);
  });

  it("marks the five talent nodes", () => {
    const svg = renderScene(<ValleyScene />);
    expect(svg.querySelectorAll("g > circle[r='4']")).toHaveLength(5);
  });

  it("keeps gradient ids unique between scenes and referenced by the artwork", () => {
    const first = renderScene(<ValleyScene />);
    const second = renderScene(<ValleyScene />);
    const idsOf = (svg: SVGSVGElement) => [...svg.querySelectorAll("defs [id]")].map((node) => node.id);
    const firstIds = idsOf(first);
    expect(firstIds).toHaveLength(4);
    expect(firstIds.some((id) => idsOf(second).includes(id))).toBe(false);
    expect(firstIds.some((id) => id.includes(":"))).toBe(false);
    const facets = first.querySelector(`[${LAYER}="facets"]`);
    expect(facets?.getAttribute("fill")).toBe(`url(#${firstIds[0]})`);
  });
});

describe("SceneContours", () => {
  it("draws 24 lines, or 13 when compact", () => {
    expect(renderInSvg(<SceneContours />).querySelectorAll(CONTOUR_PATHS)).toHaveLength(24);
    expect(renderInSvg(<SceneContours compact />).querySelectorAll(CONTOUR_PATHS)).toHaveLength(13);
  });
});

describe("SceneConnections", () => {
  it("draws the solid network line and the dashed links", () => {
    const paths = renderInSvg(<SceneConnections />).querySelectorAll(CONNECTION_PATHS);
    expect(paths).toHaveLength(2);
    expect(paths[0].hasAttribute("stroke-dasharray")).toBe(false);
    expect(paths[1].getAttribute("stroke-dasharray")).toBe("3 7");
  });
});
