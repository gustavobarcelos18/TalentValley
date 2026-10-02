"use client";

import type { ChangeEvent, ClipboardEvent, ReactNode, Ref } from "react";
import { InputAdornment, TextField } from "@mui/material";

export interface AuthFieldProps {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  onPaste?: (event: ClipboardEvent<HTMLInputElement>) => void;
  /** Control rendered at the end of the input (e.g. the show/hide button). */
  endAdornment?: ReactNode;
}

// Text input shared by the entry screens: full width, required by default and
// labelled for assistive technology.
export function AuthField({
  label,
  required = true,
  onPaste,
  endAdornment,
  ...props
}: AuthFieldProps) {
  return (
    <TextField
      {...props}
      label={label}
      required={required}
      fullWidth
      slotProps={{
        htmlInput: { "aria-label": label, onPaste },
        input: endAdornment
          ? { endAdornment: <InputAdornment position="end">{endAdornment}</InputAdornment> }
          : undefined,
      }}
    />
  );
}
