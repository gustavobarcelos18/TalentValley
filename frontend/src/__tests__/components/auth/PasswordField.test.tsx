import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { HTMLMotionProps } from "framer-motion";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordField } from "@/components/auth/PasswordField";

const motionState = vi.hoisted(() => ({ reduced: false, spans: [] as HTMLMotionProps<"span">[] }));

vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const { spyOnMotionSpan } = await import("./motionSpanSpy");
  return { ...actual, useReducedMotion: () => motionState.reduced, motion: spyOnMotionSpan(actual, motionState.spans) };
});

const SHOW = "Mostrar senha";
const HIDE = "Ocultar senha";
const RULES_LIST = "Requisitos da senha";

function renderField(props: Partial<ComponentProps<typeof PasswordField>> = {}) {
  return render(<PasswordField id="senha" name="senha" label="Senha" value="" onChange={vi.fn()} {...props} />);
}

// The icon swap is the only motion element that declares an entry state (the rules meter does not render here).
function iconSpans() {
  return motionState.spans.filter((span) => typeof span.initial === "object");
}

function input() {
  return screen.getByLabelText("Senha", { selector: "input" }) as HTMLInputElement;
}

describe("PasswordField", () => {
  beforeEach(() => {
    motionState.reduced = false;
    motionState.spans.length = 0;
  });

  it("starts as a masked input with a show button", () => {
    renderField({ value: "Segredo1" });

    expect(input().type).toBe("password");
    expect(input().value).toBe("Segredo1");
    expect(screen.getByRole("button", { name: SHOW }).getAttribute("type")).toBe("button");
  });

  it("toggles the password between hidden and visible, updating the button label", async () => {
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole("button", { name: SHOW }));
    expect(input().type).toBe("text");
    expect(screen.getByRole("button", { name: HIDE })).not.toBeNull();
    expect(screen.queryByRole("button", { name: SHOW })).toBeNull();

    await user.click(screen.getByRole("button", { name: HIDE }));
    expect(input().type).toBe("password");
    expect(screen.getByRole("button", { name: SHOW })).not.toBeNull();
  });

  it("builds the button label from the field label", () => {
    renderField({ id: "nova", label: "Confirmar Nova Senha" });

    expect(screen.getByRole("button", { name: "Mostrar confirmar nova senha" })).not.toBeNull();
  });

  it("toggles without moving the icon under reduced motion", async () => {
    motionState.reduced = true;
    const user = userEvent.setup();
    renderField();

    await user.click(screen.getByRole("button", { name: SHOW }));

    expect(input().type).toBe("text");
    await waitFor(() => expect(iconSpans().length).toBeGreaterThan(1));
    iconSpans().forEach((span) => {
      expect(span.initial).toEqual({ opacity: 0 });
      expect(span.animate).toEqual({ opacity: 1 });
      expect(span.exit).toEqual({ opacity: 0 });
    });
  });

  it("turns the icon away and the new one in when motion is allowed", () => {
    renderField();

    const [icon] = iconSpans();
    expect(icon.initial).toEqual({ opacity: 0, transform: "rotate(-90deg) scale(0.5)" });
    expect(icon.animate).toEqual({ opacity: 1, transform: "rotate(0deg) scale(1)" });
    expect(icon.exit).toEqual({ opacity: 0, transform: "rotate(90deg) scale(0.5)" });
  });

  it("forwards typing and the field props to the input", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderField({ onChange, autoComplete: "current-password", disabled: false, error: true });

    await user.type(input(), "a");

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(input().autocomplete).toBe("current-password");
    expect(input().getAttribute("aria-invalid")).toBe("true");
  });

  it("does not show the rules unless asked", () => {
    renderField({ value: "abc" });

    expect(screen.queryByRole("list", { name: RULES_LIST })).toBeNull();
    expect(screen.queryByText(/^Força da senha/)).toBeNull();
  });

  it("shows the strength meter and the rules for the current value when asked", () => {
    renderField({ value: "Abcdefg1", showRules: true });

    expect(screen.getByRole("list", { name: RULES_LIST })).not.toBeNull();
    expect(screen.getByText("Força da senha: Forte")).not.toBeNull();
    expect(input().value).toBe("Abcdefg1");
  });
});
