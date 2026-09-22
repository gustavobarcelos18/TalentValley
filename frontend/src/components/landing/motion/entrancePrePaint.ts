/**
 * Pre-paint hiding for the landing entrance.
 *
 * The reveal is client-side, so it can only own the hero after hydration. Without a hidden first
 * paint the browser shows the finished hero, blanks it and reveals it again — the flash users see.
 * The root layout adds this class before the landing markup is parsed; the reveal removes it as
 * soon as it owns the entrance, and the timer below is the failsafe for a page that never hydrates.
 * Reduced motion and no-JS users never get the class, so their content is always visible.
 */
export const entrancePendingClass = "tv-motion-pending";

/** Inline ES5 script for the root layout. */
export const entrancePrePaintScript = `(function(){if(!window.matchMedia||!window.matchMedia("(prefers-reduced-motion: no-preference)").matches)return;var root=document.documentElement;root.classList.add("${entrancePendingClass}");window.setTimeout(function(){root.classList.remove("${entrancePendingClass}")},10000)})();`;

/** Reveal decided (or reduced motion): server-rendered content must never stay hidden. */
export function clearEntrancePrePaint() {
  document.documentElement.classList.remove(entrancePendingClass);
}
