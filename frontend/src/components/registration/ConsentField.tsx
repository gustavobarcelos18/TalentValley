"use client";

import Link from "next/link";
import { Checkbox, FormControl, FormControlLabel, FormHelperText } from "@mui/material";
import type { FocusableControl } from "./registrationForm";

export function ConsentField({
  checked,
  error,
  disabled,
  onChange,
  inputRef,
}: {
  checked: boolean;
  error: string | null | undefined;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  inputRef: (node: FocusableControl) => void;
}) {
  return (
    <FormControl error={Boolean(error)}>
      <FormControlLabel
        control={
          <Checkbox
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            slotProps={{ input: { ref: inputRef } }}
            disabled={disabled}
            required
          />
        }
        label={
          <>
            Eu li e concordo com os{" "}
            <Link href="/termos" target="_blank" rel="noopener noreferrer">Termos de Uso</Link>
            {" "}e a{" "}
            <Link href="/privacidade" target="_blank" rel="noopener noreferrer">Política de Privacidade</Link>.
          </>
        }
      />
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
}
