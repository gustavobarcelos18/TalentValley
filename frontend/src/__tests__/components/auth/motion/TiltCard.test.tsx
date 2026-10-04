import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TiltCard } from "@/components/auth/motion/TiltCard";
import { stubMotionMedia } from "./motionMedia";

// Springs are replaced by their source value so the tilt is applied without waiting for physics.
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useSpring: <T,>(source: T) => source,
}));

const RECT = { x: 0, y: 0, width: 200, height: 100 };
const CARD = "tilt-card";
const GLOW_X = "--glow-x";
const GLOW_Y = "--glow-y";

function renderCard(policy: Parameters<typeof stubMotionMedia>[0]) {
  stubMotionMedia(policy);
  render(
    <TiltCard>
      <p data-testid={CARD}>conteudo</p>
    </TiltCard>,
  );
  const wrapper = screen.getByTestId(CARD).parentElement as HTMLElement;
  vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue(DOMRect.fromRect(RECT));
  return wrapper;
}

function move(wrapper: HTMLElement, clientX: number, clientY: number, pointerType = "mouse") {
  fireEvent.pointerMove(wrapper, { clientX, clientY, pointerType });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("TiltCard", () => {
  it("renders its children inside a perspective wrapper", () => {
    const wrapper = renderCard("pointer");
    expect(screen.getByTestId(CARD)).toBeTruthy();
    expect(wrapper.style.transform).toContain("perspective(900px)");
  });

  it("publishes the cursor position as glow variables", () => {
    const wrapper = renderCard("pointer");

    move(wrapper, 150, 25);
    expect(wrapper.style.getPropertyValue(GLOW_X)).toBe("75%");
    expect(wrapper.style.getPropertyValue(GLOW_Y)).toBe("25%");
  });

  it("leans toward the cursor", async () => {
    const wrapper = renderCard("pointer");

    move(wrapper, 150, 25);
    await waitFor(() => expect(wrapper.style.transform).toContain("rotateX(2.5deg)"));
    expect(wrapper.style.transform).toContain("rotateY(2.5deg)");
  });

  it("levels the card again when the pointer leaves", async () => {
    const wrapper = renderCard("pointer");
    move(wrapper, 150, 25);
    await waitFor(() => expect(wrapper.style.transform).toContain("rotateY(2.5deg)"));

    fireEvent.pointerLeave(wrapper);
    await waitFor(() => expect(wrapper.style.transform).toBe("perspective(900px)"));
  });

  it.each(["touch", "pen"])("ignores %s pointers", (pointerType) => {
    const wrapper = renderCard("pointer");

    move(wrapper, 150, 25, pointerType);
    expect(wrapper.style.getPropertyValue(GLOW_X)).toBe("");
    expect(wrapper.style.getPropertyValue(GLOW_Y)).toBe("");
  });

  it.each(["touch", "reduced"] as const)("stays plain on %s", (policy) => {
    const wrapper = renderCard(policy);

    move(wrapper, 150, 25);
    expect(wrapper.style.getPropertyValue(GLOW_X)).toBe("");
    expect(wrapper.style.getPropertyValue(GLOW_Y)).toBe("");
  });
});
