"use client";

import { useEffect, useRef } from "react";
import { Box, Step, StepLabel, Stepper, Typography } from "@mui/material";

// Visual progress of the wizard. Screen readers get the same information from
// the step heading ("Etapa 1 de 3"), so the stepper itself is decorative.
export function WizardProgress({ steps, activeStep }: { steps: string[]; activeStep: number }) {
  return (
    <Stepper activeStep={activeStep} alternativeLabel aria-hidden>
      {steps.map((label) => (
        <Step key={label}>
          <StepLabel>{label}</StepLabel>
        </Step>
      ))}
    </Stepper>
  );
}

// Heading of the step on screen. After the user moves between steps it takes
// focus, so the new step is announced; on the first render focus stays put.
// Render it once, outside the per-step content, so the step change is observed.
export function WizardStepHeading({
  step,
  total,
  title,
  description,
}: {
  step: number;
  total: number;
  title: string;
  description?: string;
}) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const shownStep = useRef(step);

  useEffect(() => {
    if (shownStep.current !== step) {
      shownStep.current = step;
      headingRef.current?.focus();
    }
  }, [step]);

  return (
    <Box>
      <Typography
        ref={headingRef}
        tabIndex={-1}
        component="h2"
        variant="h6"
        sx={{ "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 3, borderRadius: 1 } }}
      >
        <Box component="span" className="sr-only">
          Etapa {step + 1} de {total}:{" "}
        </Box>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
      )}
    </Box>
  );
}
