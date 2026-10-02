"use client";

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
  ...props
}: AuthFieldProps) {
  return (
    <TextField
      {...props}
      select={select}
      label={label}
      required={required}
      fullWidth
      slotProps={{
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
