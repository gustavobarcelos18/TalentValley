import { act } from "@testing-library/react";
import { vi } from "vitest";
import { motionQueries } from "@/components/landing/motion/LandingMotion";
import type { MotionPolicy } from "@/components/auth/motion/useMotionPolicy";

type MediaPolicy = Exclude<MotionPolicy, "pending">;

/** Replaces `window.matchMedia` so the two motion queries resolve to the given policy. */
export function stubMotionMedia(initial: MediaPolicy) {
  let policy = initial;
  const listeners = new Set<() => void>();

  const matches = (query: string) => {
    if (query === motionQueries.reduced) return policy === "reduced";
    if (query === motionQueries.pointer) return policy === "pointer";
    return false;
  };

  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return matches(query);
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    // Legacy API, still used by the MUI color scheme provider.
    addListener: () => undefined,
    removeListener: () => undefined,
  }));

  return {
    change(next: MediaPolicy) {
      policy = next;
      act(() => listeners.forEach((listener) => listener()));
    },
    listenerCount: () => listeners.size,
  };
}
