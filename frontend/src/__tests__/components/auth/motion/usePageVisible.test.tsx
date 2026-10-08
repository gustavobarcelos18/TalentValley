import { renderToString } from "react-dom/server";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePageVisible } from "@/components/auth/motion/usePageVisible";

const VISIBILITY_STATE = "visibilityState";
const VISIBILITY_CHANGE = "visibilitychange";

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, VISIBILITY_STATE, "get").mockReturnValue(state);
  act(() => {
    document.dispatchEvent(new Event(VISIBILITY_CHANGE));
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("usePageVisible", () => {
  it("is true while the tab is visible", () => {
    expect(renderHook(usePageVisible).result.current).toBe(true);
  });

  it("assumes the tab is visible on the server render", () => {
    vi.spyOn(document, VISIBILITY_STATE, "get").mockReturnValue("hidden");
    function Probe() {
      return <p>{String(usePageVisible())}</p>;
    }
    expect(renderToString(<Probe />)).toBe("<p>true</p>");
  });

  it("is false when the tab starts hidden", () => {
    vi.spyOn(document, VISIBILITY_STATE, "get").mockReturnValue("hidden");
    expect(renderHook(usePageVisible).result.current).toBe(false);
  });

  it("follows visibilitychange events", () => {
    const { result } = renderHook(usePageVisible);

    setVisibility("hidden");
    expect(result.current).toBe(false);

    setVisibility("visible");
    expect(result.current).toBe(true);
  });

  it("stops listening on unmount", () => {
    const addSpy = vi.spyOn(document, "addEventListener");
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(usePageVisible);
    const handler = addSpy.mock.calls.find(([type]) => type === VISIBILITY_CHANGE)?.[1];
    expect(handler).toBeTypeOf("function");

    unmount();
    expect(removeSpy).toHaveBeenCalledWith(VISIBILITY_CHANGE, handler);
  });
});
