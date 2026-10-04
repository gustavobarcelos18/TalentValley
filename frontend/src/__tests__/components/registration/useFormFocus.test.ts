import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useFormFocus } from "@/components/registration/useFormFocus";

const MESSAGE = "Preencha o campo.";

function summaryWithFocusSpy() {
  const summary = document.createElement("div");
  return { summary, focus: vi.spyOn(summary, "focus") };
}

describe("useFormFocus", () => {
  it("starts without an error", () => {
    const { result } = renderHook(() => useFormFocus());

    expect(result.current.error).toBeNull();
  });

  it("focuses the registered control of the reported field", () => {
    const { result } = renderHook(() => useFormFocus());
    const focus = vi.fn();
    result.current.registerFieldRef("email")({ focus });

    act(() => result.current.reportError(MESSAGE, "email"));

    expect(result.current.error).toBe(MESSAGE);
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("focuses again when the same error is reported twice", () => {
    const { result } = renderHook(() => useFormFocus());
    const focus = vi.fn();
    result.current.registerFieldRef("email")({ focus });

    act(() => result.current.reportError(MESSAGE, "email"));
    act(() => result.current.reportError(MESSAGE, "email"));

    expect(focus).toHaveBeenCalledTimes(2);
  });

  it("focuses the error summary when no focus key is given", () => {
    const { result } = renderHook(() => useFormFocus());
    const { summary, focus } = summaryWithFocusSpy();
    result.current.errorAlertRef.current = summary;

    act(() => result.current.reportError(MESSAGE));

    expect(focus).toHaveBeenCalledTimes(1);
  });

  it("focuses the error summary when the field has no registered control", () => {
    const { result } = renderHook(() => useFormFocus());
    const { summary, focus } = summaryWithFocusSpy();
    result.current.errorAlertRef.current = summary;
    result.current.registerFieldRef("email")(null);

    act(() => result.current.reportError(MESSAGE, "email"));
    act(() => result.current.reportError(MESSAGE, "unknown"));

    expect(focus).toHaveBeenCalledTimes(2);
  });

  it("does not fail when there is neither a control nor a summary", () => {
    const { result } = renderHook(() => useFormFocus());

    act(() => result.current.reportError(MESSAGE, "email"));

    expect(result.current.error).toBe(MESSAGE);
  });

  it("clears the error without moving focus", () => {
    const { result } = renderHook(() => useFormFocus());
    const focus = vi.fn();
    result.current.registerFieldRef("email")({ focus });
    act(() => result.current.reportError(MESSAGE, "email"));

    act(() => result.current.clearError());

    expect(result.current.error).toBeNull();
    expect(focus).toHaveBeenCalledTimes(1);
  });
});
