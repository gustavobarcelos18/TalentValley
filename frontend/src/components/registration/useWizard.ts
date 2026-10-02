import { useState } from "react";

// Position in a multi-step form. Validation of each step belongs to the form
// that owns the data; the wizard only decides which step is on screen.
export function useWizard(stepCount: number) {
  const [step, setStep] = useState(0);

  return {
    step,
    isFirst: step === 0,
    isLast: step === stepCount - 1,
    next: () => setStep((current) => Math.min(current + 1, stepCount - 1)),
    back: () => setStep((current) => Math.max(current - 1, 0)),
    goTo: (target: number) => setStep(Math.min(Math.max(target, 0), stepCount - 1)),
  };
}
