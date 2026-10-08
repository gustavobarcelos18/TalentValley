import { renderToString } from "react-dom/server";
import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMotionPolicy } from "@/components/auth/motion/useMotionPolicy";
import { stubMotionMedia } from "./motionMedia";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useMotionPolicy", () => {
  it("is pending on the server render", () => {
    function Probe() {
      return <p>{useMotionPolicy()}</p>;
    }
    expect(renderToString(<Probe />)).toBe("<p>pending</p>");
  });

  it("is reduced when the user prefers reduced motion, even with a fine pointer", () => {
    stubMotionMedia("reduced");
    expect(renderHook(useMotionPolicy).result.current).toBe("reduced");
  });

  it("is pointer on a wide screen with a fine pointer", () => {
    stubMotionMedia("pointer");
    expect(renderHook(useMotionPolicy).result.current).toBe("pointer");
  });

  it("is touch when neither reduced motion nor a fine pointer applies", () => {
    stubMotionMedia("touch");
    expect(renderHook(useMotionPolicy).result.current).toBe("touch");
  });

  it("follows media query changes", () => {
    const media = stubMotionMedia("touch");
    const { result } = renderHook(useMotionPolicy);

    media.change("pointer");
    expect(result.current).toBe("pointer");

    media.change("reduced");
    expect(result.current).toBe("reduced");
  });

  it("listens to both queries and stops listening on unmount", () => {
    const media = stubMotionMedia("touch");
    const { unmount } = renderHook(useMotionPolicy);
    expect(media.listenerCount()).toBeGreaterThan(0);

    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});
