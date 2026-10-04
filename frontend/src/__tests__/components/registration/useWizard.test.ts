import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWizard } from "@/components/registration/useWizard";

const STEP_COUNT = 3;

describe("useWizard", () => {
  it("starts on the first step without having moved", () => {
    const { result } = renderHook(() => useWizard(STEP_COUNT));

    expect(result.current).toMatchObject({ step: 0, direction: 1, moved: false, isFirst: true, isLast: false });
  });

  it("moves forward and marks the movement", () => {
    const { result } = renderHook(() => useWizard(STEP_COUNT));

    act(() => result.current.next());

    expect(result.current).toMatchObject({ step: 1, direction: 1, moved: true, isFirst: false, isLast: false });
  });

  it("moves back with a negative direction", () => {
    const { result } = renderHook(() => useWizard(STEP_COUNT));
    act(() => result.current.next());

    act(() => result.current.back());

    expect(result.current).toMatchObject({ step: 0, direction: -1, moved: true, isFirst: true });
  });

  it("flags the last step and stays there when advancing", () => {
    const { result } = renderHook(() => useWizard(STEP_COUNT));
    act(() => result.current.goTo(2));

    act(() => result.current.next());

    expect(result.current).toMatchObject({ step: 2, direction: 1, moved: true, isLast: true });
  });

  it("stays on the first step when going back without having moved", () => {
    const { result } = renderHook(() => useWizard(STEP_COUNT));

    act(() => result.current.back());

    expect(result.current).toMatchObject({ step: 0, direction: 1, moved: false });
  });

  it("clamps goTo to the valid range", () => {
    const { result } = renderHook(() => useWizard(STEP_COUNT));

    act(() => result.current.goTo(10));
    expect(result.current.step).toBe(2);

    act(() => result.current.goTo(-5));
    expect(result.current).toMatchObject({ step: 0, direction: -1 });
  });
});
