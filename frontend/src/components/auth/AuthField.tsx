"use client";

import { useState } from "react";
import type {
  ChangeEvent,
  ClipboardEvent,
  FocusEvent,
  HTMLAttributes,
  KeyboardEvent,
  ReactNode,
  Ref,
} from "react";
import { InputAdornment, TextField } from "@mui/material";
import { keyframes, type SxProps, type Theme } from "@mui/material/styles";
import { motion, useReducedMotion } from "framer-motion";
import { duration, ease } from "./motion/tokens";

type TextControl = HTMLInputElement | HTMLTextAreaElement;

export interface AuthFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<TextControl>) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  placeholder?: string;
  /** MUI Select exposes an imperative handle with `focus` instead of a DOM node. */
  inputRef?: Ref<TextControl | { focus: () => void }>;
  onPaste?: (event: ClipboardEvent<TextControl>) => void;
  onBlur?: (event: FocusEvent<TextControl>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  /** Renders a dropdown; pass the options as `children` (MenuItem). */
  select?: boolean;
  multiline?: boolean;
  minRows?: number;
  children?: ReactNode;
  /** Control rendered at the end of the input (e.g. the show/hide button). */
  endAdornment?: ReactNode;
}

const sweep = keyframes`
  from { opacity: 1; background-position: 100% 0; }
  to { opacity: 0; background-position: 0% 0; }
`;

// Focus treatment: a halo around the field, a band of light that runs once along its border, the
// end icon taking the accent color, and a label that settles into place with a slight overshoot.
const fieldSx: SxProps<Theme> = (theme) => {
  const palette = (theme.vars ?? theme).palette;
  return {
    "& .MuiInputLabel-root": {
      transition: "color 200ms, max-width 350ms, transform 350ms cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
    "& .MuiOutlinedInput-root": {
      transition: "box-shadow 200ms",
      "&.Mui-focused": {
        boxShadow: `0 0 0 4px color-mix(in srgb, ${palette.primary.main} 18%, transparent)`,
      },
      "&.Mui-focused.Mui-error": {
        boxShadow: `0 0 0 4px color-mix(in srgb, ${palette.error.main} 18%, transparent)`,
      },
      "&::after": {
        content: '""',
        position: "absolute",
        inset: 0,
        padding: "2px",
        borderRadius: "inherit",
        pointerEvents: "none",
        opacity: 0,
        backgroundImage: `linear-gradient(100deg, transparent 35%, ${palette.primary.light} 50%, transparent 65%)`,
        backgroundSize: "300% 100%",
        backgroundPosition: "100% 0",
        // Keeps only the 2px ring of the pseudo-element visible.
        WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        WebkitMaskComposite: "xor",
        mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
        maskComposite: "exclude",
      },
      "&.Mui-focused:not(.Mui-error)::after": { animation: `${sweep} 900ms ease-out` },
      "& .MuiIconButton-root": { transition: "color 200ms" },
      "&.Mui-focused .MuiIconButton-root": { color: palette.primary.main },
    },
    "@media (prefers-reduced-motion: reduce)": {
      "& .MuiInputLabel-root, & .MuiOutlinedInput-root": { transition: "none" },
      "& .MuiOutlinedInput-root::after": { display: "none" },
    },
  };
};

// Validation or hint text that grows open and closed instead of popping in. The last message stays in
// place while the text collapses, so it does not vanish before the animation ends.
function FieldMessage({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  const open = children !== undefined && children !== null && children !== false && children !== "";
  const [last, setLast] = useState(children);
  if (open && children !== last) setLast(children);

  return (
    <motion.span
      style={{ display: "block", overflow: "hidden" }}
      aria-hidden={!open}
      initial={false}
      animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
      transition={reduced ? { duration: 0 } : { duration: duration.base, ease: ease.outExpo }}
    >
      <span style={{ display: "block", paddingTop: 3 }}>{open ? children : last}</span>
    </motion.span>
  );
}

// Text input shared by the entry screens: full width, required by default and
// labelled for assistive technology.
export function AuthField({
  label,
  required = true,
  onPaste,
  onKeyDown,
  inputMode,
  maxLength,
  select,
  endAdornment,
  helperText,
  ...props
}: AuthFieldProps) {
  return (
    <TextField
      {...props}
      select={select}
      label={label}
      required={required}
      fullWidth
      sx={fieldSx}
      helperText={<FieldMessage>{helperText}</FieldMessage>}
      slotProps={{
        // The message element is always rendered (it animates its own height), so it
        // must not add margins of its own.
        formHelperText: { sx: { mt: 0 } },
        // A select's focusable control is its combobox, which MUI already
        // labels from the field label.
        htmlInput: {
          "aria-label": select ? undefined : label,
          onPaste,
          onKeyDown,
          inputMode,
          maxLength,
        },
        input: endAdornment
          ? { endAdornment: <InputAdornment position="end">{endAdornment}</InputAdornment> }
          : undefined,
      }}
    />
  );
}
