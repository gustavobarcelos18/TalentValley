import { renderToString } from "react-dom/server";
import { render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingMotion, motionQueries, useLandingMotionPolicy } from "@/components/landing/motion/LandingMotion";
import { configCalls, resetMotionCalls } from "./framerMotionMock";
import { stubLandingMedia } from "./landingMedia";

vi.mock("framer-motion", () => import("./framerMotionMock"));

function Probe() {
  return <p>{useLandingMotionPolicy()}</p>;
}

function renderPolicy() {
  return renderHook(useLandingMotionPolicy, { wrapper: LandingMotion });
}

describe("LandingMotion", () => {
  beforeEach(() => {
    resetMotionCalls();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes the expected media queries", () => {
    expect(motionQueries).toEqual({
      reduced: "(prefers-reduced-motion: reduce)",
      mobile: "(max-width: 767px)",
      pointer: "(min-width: 1024px) and (hover: hover) and (pointer: fine)",
    });
  });

  it("is pending outside the provider and in the server render", () => {
    expect(renderHook(useLandingMotionPolicy).result.current).toBe("pending");
    expect(renderToString(<LandingMotion><Probe /></LandingMotion>)).toBe("<p>pending</p>");
  });

  it("is reduced when the user prefers reduced motion, even on a narrow screen", () => {
    stubLandingMedia("reduced");
    expect(renderPolicy().result.current).toBe("reduced");
  });

  it("is mobile on a narrow screen", () => {
    stubLandingMedia("mobile");
    expect(renderPolicy().result.current).toBe("mobile");
  });

  it("is desktop otherwise", () => {
    stubLandingMedia("desktop");
    expect(renderPolicy().result.current).toBe("desktop");
  });

  it("renders its children and lets framer-motion follow the user's reduced-motion setting", () => {
    stubLandingMedia("desktop");
    render(<LandingMotion><p>conteudo</p></LandingMotion>);

    expect(screen.getByText("conteudo")).toBeTruthy();
    expect(configCalls.at(-1)).toEqual({ reducedMotion: "user" });
  });

  it("follows media query changes", () => {
    const media = stubLandingMedia("desktop");
    const { result } = renderPolicy();

    media.change("mobile");
    expect(result.current).toBe("mobile");

    media.change("reduced");
    expect(result.current).toBe("reduced");

    media.change("desktop");
    expect(result.current).toBe("desktop");
  });

  it("listens to both queries and stops listening on unmount", () => {
    const media = stubLandingMedia("desktop");
    const { unmount } = renderPolicy();
    expect(media.listenerCount()).toBe(2);

    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});
