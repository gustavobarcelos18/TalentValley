import { render, screen, within } from "@testing-library/react";
import type { HTMLMotionProps } from "framer-motion";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordRules } from "@/components/auth/PasswordRules";
import { duration, ease } from "@/components/auth/motion/tokens";

const motionState = vi.hoisted(() => ({ reduced: false, spans: [] as HTMLMotionProps<"span">[] }));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const { spyOnMotionSpan } = await import("./motionSpanSpy");
  return { ...actual, useReducedMotion: () => motionState.reduced, motion: spyOnMotionSpan(actual, motionState.spans) };
});

const RULES = ["Mínimo de 8 caracteres", "Uma letra maiúscula", "Uma letra minúscula", "Um dígito"];
const MET = " (atendido)";
const PENDING = " (pendente)";

// The meter segments are the only motion spans (the check marks are motion paths).
function segmentTransitions() {
  return motionState.spans.map((span) => span.transition);
}

function items() {
  return within(screen.getByRole("list", { name: "Requisitos da senha" })).getAllByRole("listitem");
}

function statusOf(rule: string) {
  const item = items().find((li) => li.textContent?.includes(rule));
  return item?.querySelector(".sr-only")?.textContent;
}

describe("PasswordRules", () => {
  beforeEach(() => {
    motionState.reduced = false;
    motionState.spans.length = 0;
  });

  it("lists the four rules, all pending for an empty password", () => {
    render(<PasswordRules value="" />);

    expect(items()).toHaveLength(RULES.length);
    RULES.forEach((rule) => expect(statusOf(rule)).toBe(PENDING));
    expect(screen.getByText("Força da senha")).not.toBeNull();
  });

  it("marks only the rules the value meets", () => {
    render(<PasswordRules value="abc" />);

    expect(statusOf("Uma letra minúscula")).toBe(MET);
    expect(statusOf("Mínimo de 8 caracteres")).toBe(PENDING);
    expect(statusOf("Uma letra maiúscula")).toBe(PENDING);
    expect(statusOf("Um dígito")).toBe(PENDING);
  });

  it("updates the checklist when the value changes", () => {
    const { rerender } = render(<PasswordRules value="abc" />);
    expect(statusOf("Um dígito")).toBe(PENDING);

    rerender(<PasswordRules value="abc1" />);

    expect(statusOf("Um dígito")).toBe(MET);
  });

  it.each<[string, string]>([
    ["abc", "Força da senha: Fraca"],
    ["abcdefgh", "Força da senha: Razoável"],
    ["Abcdefgh", "Força da senha: Boa"],
    ["Abcdefg1", "Força da senha: Forte"],
  ])("rates %s with the matching strength label", (value, label) => {
    render(<PasswordRules value={value} />);

    expect(screen.getByText(/^Força da senha/).textContent).toBe(label);
  });

  it("fills as many meter segments as the strength level", () => {
    const { container } = render(<PasswordRules value="Abcdefgh" />);

    const bars = Array.from(container.querySelectorAll('[aria-hidden="true"] > div > span'));
    expect(bars).toHaveLength(4);
    expect(bars.map((bar) => (bar as HTMLElement).style.transform)).toEqual([
      "scaleX(1)",
      "scaleX(1)",
      "scaleX(1)",
      "scaleX(0)",
    ]);
  });

  it("fills the meter instantly under reduced motion", () => {
    motionState.reduced = true;
    render(<PasswordRules value="Abcdefg1" />);

    expect(screen.getByText("Força da senha: Forte")).not.toBeNull();
    expect(segmentTransitions()).toHaveLength(4);
    segmentTransitions().forEach((transition) => expect(transition).toEqual({ duration: 0 }));
  });

  it("fills the meter over the base duration with the shared easing otherwise", () => {
    render(<PasswordRules value="Abcdefg1" />);

    expect(segmentTransitions()).toHaveLength(4);
    segmentTransitions().forEach((transition) =>
      expect(transition).toEqual({ duration: duration.base, ease: ease.outExpo }),
    );
  });
});
