import { act } from "@testing-library/react";
import { vi } from "vitest";
import { motionQueries } from "@/components/landing/motion/LandingMotion";

export type LandingMedia = "reduced" | "mobile" | "desktop";

/** Replaces `window.matchMedia` so the landing reduced/mobile queries resolve to the given policy. */
export function stubLandingMedia(initial: LandingMedia) {
  let current = initial;
  const registrations: { query: string; listener: () => void }[] = [];

  const matches = (query: string) => {
    if (query === motionQueries.reduced) return current === "reduced";
    if (query === motionQueries.mobile) return current === "mobile";
    return false;
  };

  vi.stubGlobal("matchMedia", (query: string) => ({
    media: query,
    get matches() {
      return matches(query);
    },
    addEventListener: (_type: string, listener: () => void) => registrations.push({ query, listener }),
    removeEventListener: (_type: string, listener: () => void) => {
      const index = registrations.findIndex((entry) => entry.query === query && entry.listener === listener);
      if (index >= 0) registrations.splice(index, 1);
    },
  }));

  return {
    change(next: LandingMedia) {
      current = next;
      act(() => registrations.slice().forEach(({ listener }) => listener()));
    },
    listenerCount: () => registrations.length,
  };
}
