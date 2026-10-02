"use client";

import { useRef, type ReactNode } from "react";
import { LandingMotion } from "./motion/LandingMotion";
import { useHeroDepth } from "./motion/useHeroDepth";
import { useSectionStories } from "./motion/useSectionStories";

/** Client boundary of the landing: owns the scroll motion; the content itself is server-rendered. */
export function LandingRoot({ children }: { children: ReactNode }) {
  return <LandingMotion><LandingScope>{children}</LandingScope></LandingMotion>;
}

function LandingScope({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useHeroDepth(root);
  useSectionStories(root);
  return <div className="landing" ref={root}>{children}</div>;
}
