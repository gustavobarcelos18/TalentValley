"use client";

import { useState } from "react";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { IconButton, Stack } from "@mui/material";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AuthField, type AuthFieldProps } from "./AuthField";
import { PasswordRules } from "./PasswordRules";
import { duration, ease } from "./motion/tokens";

interface PasswordFieldProps extends Omit<AuthFieldProps, "type" | "endAdornment" | "onPaste"> {
  /** Shows the strength meter and the checklist of password rules under the field (new-password fields). */
  showRules?: boolean;
}

export function PasswordField({ showRules = false, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? VisibilityOff : Visibility;
  const reduced = useReducedMotion();
  const turn = (angle: number) => (reduced ? {} : { transform: `rotate(${angle}deg) scale(0.5)` });

  const field = (
    <AuthField
      {...props}
      type={visible ? "text" : "password"}
      endAdornment={
        <IconButton
          type="button"
          aria-label={`${visible ? "Ocultar" : "Mostrar"} ${props.label.toLowerCase()}`}
          onClick={() => setVisible((v) => !v)}
          edge="end"
        >
          {/* The icon turns away and the new one turns in; only transform and opacity change. */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={visible ? "hide" : "show"}
              style={{ display: "inline-flex" }}
              initial={{ opacity: 0, ...turn(-90) }}
              animate={{ opacity: 1, ...(reduced ? {} : { transform: "rotate(0deg) scale(1)" }) }}
              exit={{ opacity: 0, ...turn(90) }}
              transition={{ duration: duration.fast, ease: ease.outExpo }}
            >
              <Icon />
            </motion.span>
          </AnimatePresence>
        </IconButton>
      }
    />
  );

  if (!showRules) return field;

  return (
    <Stack spacing={1.5}>
      {field}
      <PasswordRules value={props.value} />
    </Stack>
  );
}
