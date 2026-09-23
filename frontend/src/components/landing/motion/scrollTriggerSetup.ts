"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// ScrollTrigger requires a browser (window/document). This module is also evaluated on the server
// while Next.js prerenders the landing page, so keep registration and config client-only.
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);

  // The default auto-refresh includes the "load" event, which re-measures every trigger and
  // re-records every `invalidateOnRefresh` timeline exactly when the page finishes loading — a
  // synchronous burst that janks the first scroll. The mount-time measurement is already correct
  // (next/font uses metric-adjusted fallbacks and the hero background is `cover`, so nothing
  // changes layout on load), so refresh only when the tab becomes visible again.
  ScrollTrigger.config({ autoRefreshEvents: "visibilitychange" });
}
