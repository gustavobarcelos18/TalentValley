import { screen } from "@testing-library/react";
import { afterEach, beforeEach, vi, type Mock } from "vitest";

export const EMOJI = "\u{1F600}";

export function createStepHandlers() {
  const onChange = vi.fn();
  const onBlur = vi.fn();
  const refs = new Map<string, Mock>();

  function registerFieldRef(key: string) {
    const ref = vi.fn();
    refs.set(key, ref);
    return ref;
  }

  function reset() {
    onChange.mockClear();
    onBlur.mockClear();
    refs.clear();
  }

  return { onChange, onBlur, refs, registerFieldRef, reset };
}

export function field(label: string) {
  return screen.getByRole("textbox", { name: label }) as HTMLInputElement | HTMLTextAreaElement;
}

/** jsdom has no `document.execCommand`: installs a spy for each test and removes it afterwards. */
export function useExecCommandSpy() {
  const execCommand = vi.fn();

  beforeEach(() => {
    execCommand.mockClear();
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "execCommand");
  });

  return execCommand;
}
