import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRetryCountdown } from "@/components/auth/motion/useRetryCountdown";
import { ApiError } from "@/lib/api";

const TOO_MANY = "Too many requests";

function rateLimited(retryAfterSeconds?: number) {
  return new ApiError(429, TOO_MANY, undefined, retryAfterSeconds);
}

function observe(result: { current: { observe: (error: unknown) => void } }, error: unknown) {
  act(() => result.current.observe(error));
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRetryCountdown", () => {
  it("starts free", () => {
    const { result } = renderHook(useRetryCountdown);
    expect(result.current).toMatchObject({ remaining: 0, total: 0, finished: 0 });
  });

  it("starts counting from the Retry-After of a 429", () => {
    const { result } = renderHook(useRetryCountdown);
    observe(result, rateLimited(5));
    expect(result.current).toMatchObject({ remaining: 5, total: 5, finished: 0 });
  });

  it.each([
    ["a 429 without Retry-After", rateLimited()],
    ["a 429 with a zero Retry-After", rateLimited(0)],
    ["an ApiError that is not a 429", new ApiError(500, "Server error", undefined, 5)],
    ["a plain Error", new Error(TOO_MANY)],
    ["a non-error value", "429"],
  ])("ignores %s", (_label, error) => {
    const { result } = renderHook(useRetryCountdown);
    observe(result, error);
    expect(result.current).toMatchObject({ remaining: 0, total: 0, finished: 0 });
  });

  it("counts down in whole seconds as time passes", () => {
    const { result } = renderHook(useRetryCountdown);
    observe(result, rateLimited(3));

    advance(1000);
    expect(result.current.remaining).toBe(2);

    advance(1000);
    expect(result.current.remaining).toBe(1);
    expect(result.current.total).toBe(3);
  });

  it("keeps the state untouched between second boundaries", () => {
    const { result } = renderHook(useRetryCountdown);
    observe(result, rateLimited(3));

    advance(250);
    expect(result.current.remaining).toBe(3);
  });

  it("reaches zero once and counts the finished wait", () => {
    const { result } = renderHook(useRetryCountdown);
    observe(result, rateLimited(2));

    advance(2000);
    expect(result.current).toMatchObject({ remaining: 0, total: 2, finished: 1 });

    advance(5000);
    expect(result.current.finished).toBe(1);
  });

  it("restarts from a new 429 and counts every finished wait", () => {
    const { result } = renderHook(useRetryCountdown);
    observe(result, rateLimited(1));
    advance(1000);
    expect(result.current.finished).toBe(1);

    observe(result, rateLimited(4));
    expect(result.current).toMatchObject({ remaining: 4, total: 4, finished: 1 });

    advance(4000);
    expect(result.current).toMatchObject({ remaining: 0, finished: 2 });
  });

  it("clears its interval on unmount", () => {
    const { result, unmount } = renderHook(useRetryCountdown);
    observe(result, rateLimited(5));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
