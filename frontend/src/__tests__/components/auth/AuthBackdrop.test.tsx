import type { ReactNode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthBackdrop } from "@/components/auth/AuthBackdrop";

const state = vi.hoisted(() => ({
  policy: "pointer" as "pending" | "reduced" | "touch" | "pointer",
  inView: true,
  scope: { current: null as HTMLSpanElement | null },
  animate: vi.fn(),
  cancel: vi.fn(),
  pointer: null as { x: { get: () => number } } | null,
}));

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useInView: () => state.inView,
  useAnimate: () => [state.scope, state.animate],
}));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => state.policy }));
vi.mock("@/components/auth/motion/AmbientMotion", () => ({
  AmbientMotion: ({ active, children }: { active: boolean; children: ReactNode }) => (
    <div data-testid="ambient" data-active={String(active)}>
      {children}
    </div>
  ),
}));
vi.mock("@/components/auth/motion/AuroraBackground", () => ({ AuroraBackground: () => <div data-testid="aurora" /> }));
vi.mock("@/components/auth/motion/TalentNetwork", () => ({ TalentNetwork: () => <div data-testid="network" /> }));
vi.mock("@/components/auth/motion/DotSpotlight", () => ({
  DotSpotlight: ({ pointer }: { pointer: { x: { get: () => number } } }) => {
    state.pointer = pointer;
    return <div data-testid="spotlight" />;
  },
}));
vi.mock("@/components/auth/LoginVisualScene", () => ({ LoginVisualScene: () => <div data-testid="scene" /> }));

function setVisibility(value: DocumentVisibilityState) {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(value);
}

function renderBackdrop(props: { entrance?: boolean; compact?: boolean } = {}) {
  return render(
    <AuthBackdrop entrance={props.entrance ?? false} compact={props.compact}>
      <p>conteúdo</p>
    </AuthBackdrop>,
  );
}

describe("AuthBackdrop", () => {
  beforeEach(() => {
    state.policy = "pointer";
    state.inView = true;
    state.pointer = null;
    state.scope.current = null;
    state.animate.mockReset();
    state.cancel.mockReset();
    state.animate.mockReturnValue({ cancel: state.cancel });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is the main landmark and holds the children over the animated layers", () => {
    renderBackdrop();

    const main = screen.getByRole("main");
    expect(main.contains(screen.getByText("conteúdo"))).toBe(true);
    ["aurora", "spotlight", "scene", "network"].forEach((id) => {
      expect(main.contains(screen.getByTestId(id))).toBe(true);
    });
  });

  it("hands the pointer motion values to the spotlight", () => {
    renderBackdrop();

    expect(state.pointer?.x.get()).toBe(0);
  });

  it("shows the brand lockup with the wordmark and the tagline", () => {
    renderBackdrop();

    expect(screen.getByText("Valley").tagName).toBe("EM");
    expect(screen.getByText("by Rio Pomba Valley")).not.toBeNull();
    expect(screen.getByRole("main").querySelector(".tv-brand svg")).not.toBeNull();
  });

  describe("ambient loops", () => {
    it("play while the tab is visible and the screen is in view", () => {
      setVisibility("visible");
      renderBackdrop();

      expect(screen.getByTestId("ambient").getAttribute("data-active")).toBe("true");
    });

    it("pause while the screen is out of view", () => {
      state.inView = false;
      renderBackdrop();

      expect(screen.getByTestId("ambient").getAttribute("data-active")).toBe("false");
    });

    it("pause while the tab is hidden and resume when it comes back", () => {
      setVisibility("hidden");
      renderBackdrop();
      expect(screen.getByTestId("ambient").getAttribute("data-active")).toBe("false");

      setVisibility("visible");
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });

      expect(screen.getByTestId("ambient").getAttribute("data-active")).toBe("true");
    });
  });

  describe("spacing", () => {
    function contentArea() {
      return screen.getByText("conteúdo").parentElement as HTMLElement;
    }

    it("leaves room below the card by default", () => {
      renderBackdrop();

      expect(getComputedStyle(contentArea()).paddingBottom).toBe("48px");
    });

    it("tightens the space below the card when compact", () => {
      renderBackdrop({ compact: true });

      expect(getComputedStyle(contentArea()).paddingBottom).toBe("24px");
    });
  });

  describe("brand entrance", () => {
    function markWrapper() {
      return screen.getByRole("main").querySelector(".tv-brand > span") as HTMLElement;
    }

    it("starts the mark transparent when the entrance plays", () => {
      renderBackdrop({ entrance: true });

      expect(markWrapper().style.opacity).toBe("0");
    });

    it("keeps the mark visible when there is no entrance", () => {
      renderBackdrop({ entrance: false });

      expect(markWrapper().style.opacity).toBe("1");
    });

    it.each<"touch" | "pointer">(["touch", "pointer"])("draws the outline of the mark on a %s device", (policy) => {
      state.policy = policy;
      renderBackdrop({ entrance: true });

      expect(state.animate).toHaveBeenCalledTimes(1);
      const [outlines, keyframes] = state.animate.mock.calls[0];
      expect(outlines).toHaveLength(2);
      expect((outlines as Element[]).every((path) => path.hasAttribute("stroke"))).toBe(true);
      expect(keyframes).toEqual({ pathLength: [0, 1] });
    });

    it("cancels the drawing when it unmounts", () => {
      const { unmount } = renderBackdrop({ entrance: true });
      expect(state.cancel).not.toHaveBeenCalled();

      unmount();

      expect(state.cancel).toHaveBeenCalledTimes(1);
    });

    it.each<"pending" | "reduced">(["pending", "reduced"])("does not draw the outline with %s motion", (policy) => {
      state.policy = policy;
      renderBackdrop({ entrance: true });

      expect(state.animate).not.toHaveBeenCalled();
    });

    it("does not draw the outline without an entrance", () => {
      renderBackdrop({ entrance: false });

      expect(state.animate).not.toHaveBeenCalled();
    });
  });
});
