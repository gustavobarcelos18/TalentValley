import type { CSSProperties } from "react";

/** Delay (seconds) for the CSS entrance; pair it with the `entrance` class. Needs no JavaScript. */
export function entrance(delay: number) {
  return { "--entrance-delay": delay } as CSSProperties;
}
