import { useCallback, useEffect, useRef, useState } from "react";
import type { FocusableControl } from "./registrationForm";

// Error summary and focus handling shared by the registration forms. After a
// failed submission focus moves to the first invalid field, or to the error
// summary for submission/server errors. The sequence id re-runs the effect even
// when the same error is reported twice in a row, and also after a step change
// triggered in the same update (the target field is mounted by then).
export function useFormFocus() {
  const [error, setError] = useState<string | null>(null);
  const [errorSequence, setErrorSequence] = useState(0);
  const errorAlertRef = useRef<HTMLDivElement | null>(null);
  const fieldRefs = useRef<Partial<Record<string, FocusableControl>>>({});
  const lastErrorFocus = useRef<string | null>(null);

  const registerFieldRef = (key: string) => (node: FocusableControl) => {
    fieldRefs.current[key] = node;
  };

  useEffect(() => {
    if (errorSequence === 0) return;
    const key = lastErrorFocus.current;
    if (key && fieldRefs.current[key]) {
      fieldRefs.current[key]?.focus();
      return;
    }
    // Fallback: the target field has no registered focusable control, so move
    // focus to the error summary instead.
    errorAlertRef.current?.focus();
  }, [errorSequence]);

  const clearError = useCallback(() => setError(null), []);

  function reportError(message: string, focusKey: string | null = null) {
    lastErrorFocus.current = focusKey;
    setError(message);
    setErrorSequence((n) => n + 1);
  }

  return {
    error,
    clearError,
    reportError,
    errorAlertRef,
    registerFieldRef,
  };
}
