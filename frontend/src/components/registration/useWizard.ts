import { useState } from "react";

// Position in a multi-step form. Validation of each step belongs to the form
// that owns the data; the wizard only decides which step is on screen.
// `direction` says which way the last change went (1 forward, -1 back) and
// `moved` whether the person left the first step at all; both only drive motion.
export function useWizard(stepCount: number) {
  const [position, setPosition] = useState({ step: 0, direction: 1, moved: false });

  const goTo = (target: number) =>
    setPosition((current) => {
      const step = Math.min(Math.max(target, 0), stepCount - 1);
      if (step === current.step) return current;
      return { step, direction: step > current.step ? 1 : -1, moved: true };
    });

  return {
    step: position.step,
    direction: position.direction,
    moved: position.moved,
    isFirst: position.step === 0,
    isLast: position.step === stepCount - 1,
    next: () => goTo(position.step + 1),
    back: () => goTo(position.step - 1),
    goTo,
  };
}
