import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionMotion } from "@/components/landing/motion/ActionMotion";
import { LandingMotion } from "@/components/landing/motion/LandingMotion";
import { motionCalls, resetMotionCalls } from "./framerMotionMock";
import { stubLandingMedia, type LandingMedia } from "./landingMedia";

vi.mock("framer-motion", () => import("./framerMotionMock"));

function renderAction(policy: LandingMedia | null) {
  const action = <ActionMotion><a href="/cadastro">Entrar</a></ActionMotion>;
  if (policy === null) return render(action);
  stubLandingMedia(policy);
  return render(<LandingMotion>{action}</LandingMotion>);
}

function actionProps() {
  const call = motionCalls.findLast((entry) => entry.tag === "div");
  if (!call) throw new Error("ActionMotion did not render a motion.div");
  return call.props;
}

describe("ActionMotion", () => {
  beforeEach(() => {
    resetMotionCalls();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders its children inside the motion wrapper", () => {
    renderAction("desktop");
    expect(screen.getByRole("link", { name: "Entrar" }).parentElement?.tagName).toBe("DIV");
  });

  it("lifts the action on hover on desktop", () => {
    renderAction("desktop");
    expect(actionProps().whileHover).toEqual({ y: -3 });
    expect(actionProps().transition).toEqual({ duration: 0.2 });
  });

  it.each<[string, LandingMedia | null]>([
    ["before the policy is known", null],
    ["on mobile", "mobile"],
    ["with reduced motion", "reduced"],
  ])("does not animate on hover %s", (_label, policy) => {
    renderAction(policy);
    expect(actionProps().whileHover).toBeUndefined();
  });
});
