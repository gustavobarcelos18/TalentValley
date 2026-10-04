import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MagneticButton } from "@/components/auth/motion/MagneticButton";
import { stubMotionMedia } from "./motionMedia";

// Springs are replaced by their source value so the pull is applied without waiting for physics.
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useSpring: <T,>(source: T) => source,
}));

// Center of the wrapper is (100, 50).
const RECT = { x: 0, y: 0, width: 200, height: 100 };
const BUTTON = "Entrar";
const AT_REST = "none";

function renderButton(policy: Parameters<typeof stubMotionMedia>[0], disabled?: boolean) {
  stubMotionMedia(policy);
  render(
    <MagneticButton disabled={disabled}>
      <button type="button">{BUTTON}</button>
    </MagneticButton>,
  );
  const wrapper = screen.getByRole("button", { name: BUTTON }).parentElement as HTMLElement;
  vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect(RECT));
  return wrapper;
}

function move(wrapper: HTMLElement, clientX: number, clientY: number) {
  fireEvent.pointerMove(wrapper, { clientX, clientY });
}

function press(wrapper: HTMLElement) {
  fireEvent.pointerDown(wrapper, { isPrimary: true, button: 0 });
}

function transformOf(wrapper: HTMLElement) {
  return wrapper.style.transform || AT_REST;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("MagneticButton", () => {
  it("renders its children", () => {
    renderButton("pointer");
    expect(screen.getByRole("button", { name: BUTTON })).toBeTruthy();
  });

  it("leans toward the cursor by a fifth of its distance from the center", async () => {
    const wrapper = renderButton("pointer");

    move(wrapper, 120, 40);
    await waitFor(() => expect(transformOf(wrapper)).toBe("translateX(4px) translateY(-2px)"));
  });

  it("caps the pull at 8px on each axis", async () => {
    const wrapper = renderButton("pointer");

    move(wrapper, 200, 0);
    await waitFor(() => expect(transformOf(wrapper)).toBe("translateX(8px) translateY(-8px)"));

    move(wrapper, -500, 500);
    await waitFor(() => expect(transformOf(wrapper)).toBe("translateX(-8px) translateY(8px)"));
  });

  it("lets go when the pointer leaves", async () => {
    const wrapper = renderButton("pointer");
    move(wrapper, 120, 40);
    await waitFor(() => expect(transformOf(wrapper)).toBe("translateX(4px) translateY(-2px)"));

    fireEvent.pointerLeave(wrapper);
    await waitFor(() => expect(transformOf(wrapper)).toBe(AT_REST));
  });

  it("sinks slightly while pressed", async () => {
    const wrapper = renderButton("pointer");

    press(wrapper);
    await waitFor(() => expect(transformOf(wrapper)).toContain("scale(0.97)"), { timeout: 3000 });
  });

  it.each([
    ["touch", false],
    ["reduced", false],
    ["pointer", true],
  ] as const)("does not pull or sink on %s (disabled: %s)", async (policy, disabled) => {
    vi.useFakeTimers();
    const wrapper = renderButton(policy, disabled);

    move(wrapper, 120, 40);
    press(wrapper);
    await vi.advanceTimersByTimeAsync(300);
    expect(transformOf(wrapper)).toBe(AT_REST);
  });
});
