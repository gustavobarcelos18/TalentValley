"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { AnimatePresence, motion } from "framer-motion";
import { cascadeSx } from "@/components/auth/AuthFormPage";
import { CheckDraw } from "@/components/auth/motion/CheckDraw";
import { duration, ease, spring } from "@/components/auth/motion/tokens";
import { useMotionPolicy } from "@/components/auth/motion/useMotionPolicy";

const DOT = 32;
const MotionBox = motion.create(Box);

// Visual progress of the wizard: a rail that fills up, one dot per step (a drawn check once the
// step is behind, a ring that slides to the step on screen). Screen readers get the same
// information from the step heading ("Etapa 1 de 3"), so the whole thing is decorative.
export function WizardProgress({ steps, activeStep }: { steps: string[]; activeStep: number }) {
  const last = steps.length - 1;
  const inset = `${50 / steps.length}%`;

  return (
    <Box
      aria-hidden
      sx={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
    >
      <Box
        sx={{
          position: "absolute",
          top: DOT / 2 - 1,
          left: inset,
          right: inset,
          height: 2,
          borderRadius: 1,
          bgcolor: "divider",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            height: "100%",
            bgcolor: "primary.main",
            transformOrigin: "left",
            transform: `scaleX(${last > 0 ? activeStep / last : 0})`,
            transition: "transform 500ms cubic-bezier(0.16, 1, 0.3, 1)",
            "@media (prefers-reduced-motion: reduce)": { transition: "none" },
          }}
        />
      </Box>

      {steps.map((label, index) => {
        const done = index < activeStep;
        const active = index === activeStep;
        return (
          <Box key={label} sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Box
              sx={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: DOT,
                height: DOT,
                border: 1,
                borderColor: done || active ? "primary.main" : "divider",
                borderRadius: "50%",
                bgcolor: done || active ? "primary.main" : "background.paper",
                color: done || active ? "primary.contrastText" : "text.secondary",
                fontSize: "0.8125rem",
                fontWeight: 600,
                transition: "background-color 300ms, border-color 300ms, color 300ms",
                "@media (prefers-reduced-motion: reduce)": { transition: "none" },
              }}
            >
              {done ? <CheckDraw size={16} circle={false} strokeWidth={2.5} /> : index + 1}
              {active && (
                <MotionBox
                  layoutId="wizard-active-ring"
                  // Measured only when the step changes, so a card that re-centers (error alert,
                  // taller content) never makes the ring spring away from its dot.
                  layoutDependency={activeStep}
                  transition={spring.snappy}
                  sx={{
                    position: "absolute",
                    inset: -5,
                    border: 2,
                    borderColor: "primary.main",
                    borderRadius: "50%",
                  }}
                />
              )}
            </Box>
            <Typography
              variant="caption"
              sx={{
                mt: 1,
                color: done || active ? "text.primary" : "text.secondary",
                fontWeight: active ? 600 : 400,
                transition: "color 300ms",
              }}
            >
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
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

const SLIDE = { pointer: 28, touch: 14, reduced: 0, pending: 0 } as const;

// Step on screen enters sliding in from the side it was reached from; the step it replaces fades
// out in place. The previous step is taken out of the flow while it leaves (popLayout), so the
// new one is mounted at once: focusing a field of the new step right after the change keeps working.
// The fields of a step rise one after another through the same cascade as the rest of the form.
export function WizardStepTransition({
  step,
  direction,
  moved,
  children,
}: {
  step: number;
  direction: number;
  moved: boolean;
  children: ReactNode;
}) {
  const policy = useMotionPolicy();
  const distance = SLIDE[policy];

  return (
    // data-no-enter: the form cascade skips this group; its fields are cascaded below.
    <Box data-no-enter="" sx={{ position: "relative" }}>
      <AnimatePresence initial={false} mode="popLayout" custom={direction}>
        <motion.div
          key={step}
          custom={direction}
          variants={{
            enter: (dir: number) => ({ transform: `translateX(${dir * distance}px)` }),
            center: { transform: "translateX(0px)", transition: { duration: duration.slow, ease: ease.outExpo } },
            exit: { opacity: 0, transition: { duration: duration.fast, ease: ease.inOut } },
          }}
          initial="enter"
          animate="center"
          exit="exit"
        >
          {/* The first mount waits for the heading above it; later ones start at once. */}
          {/* Two columns from 40rem up; a field that needs the full width spans both (sm:col-span-2). */}
          <Box
            sx={{
              display: "grid",
              // 40rem is Tailwind's `sm`, the breakpoint the sm:col-span-2 cells use (MUI's sm is 600px).
              gridTemplateColumns: "minmax(0, 1fr)",
              "@media (min-width: 40rem)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
              gap: 2,
              ...cascadeSx(moved ? 0 : 5),
            }}
          >
            {children}
          </Box>
        </motion.div>
      </AnimatePresence>
    </Box>
  );
}
