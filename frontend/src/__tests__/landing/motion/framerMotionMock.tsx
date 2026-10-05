import { createElement, type ReactNode } from "react";

/** Props received by each mocked framer-motion element, in render order. */
export const motionCalls: { tag: string; props: Record<string, unknown> }[] = [];
export const presenceCalls: Record<string, unknown>[] = [];
export const configCalls: Record<string, unknown>[] = [];

type MockProps = Record<string, unknown> & { children?: ReactNode; className?: string };

function mockElement(tag: string) {
  return function MockMotionElement({ children, className, ...props }: MockProps) {
    motionCalls.push({ tag, props });
    return createElement(tag, { className, "aria-hidden": props["aria-hidden"] }, children);
  };
}

export function resetMotionCalls() {
  motionCalls.length = 0;
  presenceCalls.length = 0;
  configCalls.length = 0;
}

export const motion = { div: mockElement("div"), ol: mockElement("ol"), li: mockElement("li"), span: mockElement("span") };

export function AnimatePresence({ children, ...props }: MockProps) {
  presenceCalls.push(props);
  return <>{children}</>;
}

export function MotionConfig({ children, ...props }: MockProps) {
  configCalls.push(props);
  return <>{children}</>;
}
