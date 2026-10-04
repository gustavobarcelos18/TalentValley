import { forwardRef } from "react";
import type { HTMLMotionProps } from "framer-motion";

type FramerMotion = typeof import("framer-motion");

/**
 * Returns a `motion` namespace whose `span` still animates for real but records the props it
 * receives, so tests can assert on what a component asked framer-motion to do.
 */
export function spyOnMotionSpan(actual: FramerMotion, sink: HTMLMotionProps<"span">[]): FramerMotion["motion"] {
  const RealSpan = actual.motion.span;
  const SpiedSpan = forwardRef<HTMLSpanElement, HTMLMotionProps<"span">>(function SpiedSpan(props, ref) {
    sink.push(props);
    return <RealSpan {...props} ref={ref} />;
  });

  return new Proxy(actual.motion, {
    get: (target, key, receiver) => (key === "span" ? SpiedSpan : Reflect.get(target, key, receiver)),
  });
}
