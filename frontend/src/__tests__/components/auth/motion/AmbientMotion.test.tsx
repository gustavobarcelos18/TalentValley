import type { ReactNode } from "react";
import type { AnimationOptions, DOMKeyframesDefinition } from "framer-motion";
import { renderToString } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AmbientMotion, useAmbient, useLoop } from "@/components/auth/motion/AmbientMotion";
import { stubMotionMedia } from "./motionMedia";

const framer = vi.hoisted(() => ({
  scope: { current: null as Element | null },
  animate: vi.fn(),
}));

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useAnimate: () => [framer.scope, framer.animate],
}));

const KEYFRAMES: DOMKeyframesDefinition = { opacity: [0, 1] };
const OPTIONS: AnimationOptions = { duration: 2 };
const ENABLED_ACTIVE = "enabled:true active:true";
const ENABLED_PAUSED = "enabled:true active:false";
const DISABLED = "enabled:false active:false";

function createControls() {
  return { play: vi.fn(), pause: vi.fn(), cancel: vi.fn() };
}

function AmbientState() {
  const { enabled, active } = useAmbient();
  return <p>{`enabled:${enabled} active:${active}`}</p>;
}

function Detached() {
  useLoop<HTMLDivElement>(KEYFRAMES, OPTIONS);
  return null;
}

function Looping() {
  const scope = useLoop<HTMLDivElement>(KEYFRAMES, OPTIONS);
  return <div ref={scope} />;
}

beforeEach(() => {
  framer.scope.current = null;
  framer.animate.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AmbientMotion", () => {
  it("has no loops by default, without a provider", () => {
    render(<AmbientState />);
    expect(screen.getByText(DISABLED)).toBeTruthy();
  });

  it("has no loops on the server render", () => {
    const html = renderToString(
      <AmbientMotion active>
        <AmbientState />
      </AmbientMotion>,
    );
    expect(html).toContain(DISABLED);
  });

  it.each(["touch", "pointer"] as const)("enables and plays the loops on %s while active", (policy) => {
    stubMotionMedia(policy);
    render(
      <AmbientMotion active>
        <AmbientState />
      </AmbientMotion>,
    );
    expect(screen.getByText(ENABLED_ACTIVE)).toBeTruthy();
  });

  it("keeps the loops enabled but paused while inactive", () => {
    stubMotionMedia("pointer");
    render(
      <AmbientMotion active={false}>
        <AmbientState />
      </AmbientMotion>,
    );
    expect(screen.getByText(ENABLED_PAUSED)).toBeTruthy();
  });

  it("turns the loops off with reduced motion, even while active", () => {
    stubMotionMedia("reduced");
    render(
      <AmbientMotion active>
        <AmbientState />
      </AmbientMotion>,
    );
    expect(screen.getByText(DISABLED)).toBeTruthy();
  });
});

describe("useLoop", () => {
  function renderLoop(active: boolean, Loop: () => ReactNode = Looping) {
    const controls = createControls();
    framer.animate.mockReturnValue(controls);
    const ui = (isActive: boolean) => (
      <AmbientMotion active={isActive}>
        <Loop />
      </AmbientMotion>
    );
    const view = render(ui(active));
    return { controls, rerenderWith: (isActive: boolean) => view.rerender(ui(isActive)), unmount: view.unmount };
  }

  function attachTarget() {
    const target = document.createElement("div");
    framer.scope.current = target;
    return target;
  }

  it("does not animate when the loops are disabled", () => {
    stubMotionMedia("reduced");
    attachTarget();
    renderLoop(true);
    expect(framer.animate).not.toHaveBeenCalled();
  });

  it("does not animate without an element", () => {
    stubMotionMedia("pointer");
    renderLoop(true, Detached);
    expect(framer.animate).not.toHaveBeenCalled();
  });

  it("starts an endless animation on the element", () => {
    stubMotionMedia("pointer");
    const target = attachTarget();
    renderLoop(true);
    expect(framer.animate).toHaveBeenCalledTimes(1);
    expect(framer.animate).toHaveBeenCalledWith(target, KEYFRAMES, { duration: 2, repeat: Infinity });
  });

  it("plays while active and pauses once inactive", () => {
    stubMotionMedia("pointer");
    attachTarget();
    const { controls, rerenderWith } = renderLoop(true);
    expect(controls.play).toHaveBeenCalledTimes(1);
    expect(controls.pause).not.toHaveBeenCalled();

    rerenderWith(false);
    expect(controls.pause).toHaveBeenCalledTimes(1);

    rerenderWith(true);
    expect(controls.play).toHaveBeenCalledTimes(2);
    expect(framer.animate).toHaveBeenCalledTimes(1);
  });

  it("pauses straight away when it starts inactive", () => {
    stubMotionMedia("touch");
    attachTarget();
    const { controls } = renderLoop(false);
    expect(controls.pause).toHaveBeenCalledTimes(1);
    expect(controls.play).not.toHaveBeenCalled();
  });

  it("cancels the animation on unmount", () => {
    stubMotionMedia("pointer");
    attachTarget();
    const { controls, unmount } = renderLoop(true);
    expect(controls.cancel).not.toHaveBeenCalled();

    unmount();
    expect(controls.cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels the animation and stops controlling it when the loops get disabled", () => {
    const media = stubMotionMedia("pointer");
    attachTarget();
    const { controls } = renderLoop(true);
    const pausesBefore = controls.pause.mock.calls.length;

    media.change("reduced");
    expect(controls.cancel).toHaveBeenCalledTimes(1);
    expect(controls.pause).toHaveBeenCalledTimes(pausesBefore);
  });
});
