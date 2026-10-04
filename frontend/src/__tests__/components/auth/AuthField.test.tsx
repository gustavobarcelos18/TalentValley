import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MenuItem } from "@mui/material";
import type { HTMLMotionProps } from "framer-motion";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthField } from "@/components/auth/AuthField";
import { duration, ease } from "@/components/auth/motion/tokens";

const motionState = vi.hoisted(() => ({ reduced: false, spans: [] as HTMLMotionProps<"span">[] }));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const { spyOnMotionSpan } = await import("./motionSpanSpy");
  return { ...actual, useReducedMotion: () => motionState.reduced, motion: spyOnMotionSpan(actual, motionState.spans) };
});

const LABEL = "E-mail";
const ARIA_HIDDEN = "aria-hidden";
const HELPER = "Use o e-mail institucional";

function renderField(props: Partial<ComponentProps<typeof AuthField>> = {}) {
  return render(<AuthField id="email" name="email" label={LABEL} value="" onChange={vi.fn()} {...props} />);
}

// The helper message is the only motion element of the field.
function messageTransition() {
  return motionState.spans.at(-1)?.transition;
}

function input() {
  return screen.getByRole("textbox", { name: LABEL }) as HTMLInputElement;
}

describe("AuthField", () => {
  beforeEach(() => {
    motionState.reduced = false;
    motionState.spans.length = 0;
  });

  it("labels the input for assistive technology and wires id, name and value", () => {
    renderField({ value: "ana@example.com" });

    expect(input().id).toBe("email");
    expect(input().name).toBe("email");
    expect(input().value).toBe("ana@example.com");
    expect(input().getAttribute("aria-label")).toBe(LABEL);
  });

  it("is required by default and optional when asked", () => {
    const { unmount } = renderField();
    expect(input().required).toBe(true);
    unmount();

    renderField({ required: false });
    expect(input().required).toBe(false);
  });

  it("forwards typing, paste and key presses to the handlers", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onPaste = vi.fn();
    const onKeyDown = vi.fn();
    renderField({ onChange, onPaste, onKeyDown });

    await user.click(input());
    await user.keyboard("a");
    await user.paste("x");

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
    expect(onKeyDown.mock.calls[0][0].key).toBe("a");
    expect(onPaste).toHaveBeenCalledTimes(1);
  });

  it("forwards blur", async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();
    renderField({ onBlur });

    await user.click(input());
    await user.tab();

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("applies inputMode, maxLength, placeholder, autoComplete and type", () => {
    renderField({ inputMode: "numeric", maxLength: 6, placeholder: "000000", autoComplete: "one-time-code", type: "tel" });

    expect(input().getAttribute("inputmode")).toBe("numeric");
    expect(input().maxLength).toBe(6);
    expect(input().placeholder).toBe("000000");
    expect(input().autocomplete).toBe("one-time-code");
    expect(input().type).toBe("tel");
  });

  it("can be disabled and flagged invalid", () => {
    renderField({ disabled: true, error: true });

    expect(input().disabled).toBe(true);
    expect(input().getAttribute("aria-invalid")).toBe("true");
  });

  it("is a plain text input unless told otherwise", () => {
    renderField();

    expect(input().getAttribute("aria-invalid")).toBe("false");
    expect(input().type).toBe("text");
  });

  it("exposes the imperative input ref", () => {
    const inputRef = { current: null as { focus: () => void } | null };
    renderField({ inputRef });

    expect(inputRef.current).toBe(input());
  });

  it("renders the control passed as the end adornment", () => {
    renderField({ endAdornment: <button type="button">mostrar</button> });

    expect(screen.getByRole("button", { name: "mostrar" })).not.toBeNull();
  });

  it("renders a textarea when multiline", () => {
    renderField({ multiline: true, minRows: 3 });

    expect(input().tagName).toBe("TEXTAREA");
  });

  describe("helper message", () => {
    it("shows the message and exposes it to assistive technology", () => {
      renderField({ helperText: HELPER });

      expect(screen.getByText(HELPER).parentElement?.getAttribute(ARIA_HIDDEN)).toBe("false");
      expect(input().getAttribute("aria-describedby")).toBe("email-helper-text");
    });

    it.each<ComponentProps<typeof AuthField>["helperText"]>([undefined, null, false, ""])(
      "hides the message element when the text is %j",
      (helperText) => {
        renderField({ helperText });

        const helper = document.getElementById("email-helper-text") as HTMLElement;
        expect(helper.firstElementChild?.getAttribute(ARIA_HIDDEN)).toBe("true");
      },
    );

    it("keeps the last message in place while it collapses", () => {
      const { rerender } = renderField({ helperText: HELPER });

      rerender(<AuthField id="email" name="email" label={LABEL} value="" onChange={vi.fn()} helperText={undefined} />);

      expect(screen.getByText(HELPER).parentElement?.getAttribute(ARIA_HIDDEN)).toBe("true");
    });

    it("swaps in a new message when the text changes", () => {
      const { rerender } = renderField({ helperText: HELPER });

      rerender(<AuthField id="email" name="email" label={LABEL} value="" onChange={vi.fn()} helperText="Outro texto" />);

      expect(screen.getByText("Outro texto")).not.toBeNull();
      expect(screen.queryByText(HELPER)).toBeNull();
    });

    it("animates with a zero duration under reduced motion", () => {
      motionState.reduced = true;
      renderField({ helperText: HELPER });

      expect(messageTransition()).toEqual({ duration: 0 });
    });

    it("animates over the base duration with the shared easing otherwise", () => {
      renderField({ helperText: HELPER });

      expect(messageTransition()).toEqual({ duration: duration.base, ease: ease.outExpo });
    });
  });

  describe("select", () => {
    it("renders a combobox labelled by the field label and lets the user pick an option", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(
        <AuthField id="curso" name="curso" label="Curso" value="" onChange={onChange} select>
          <MenuItem value="si">Sistemas de Informação</MenuItem>
          <MenuItem value="ads">Análise e Desenvolvimento</MenuItem>
        </AuthField>,
      );

      const combobox = screen.getByRole("combobox", { name: /Curso/ });
      expect(combobox.getAttribute("aria-label")).toBeNull();
      expect(document.querySelector("input[aria-label]")).toBeNull();

      await user.click(combobox);
      await user.click(screen.getByRole("option", { name: "Análise e Desenvolvimento" }));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange.mock.calls[0][0].target.value).toBe("ads");
    });
  });
});
