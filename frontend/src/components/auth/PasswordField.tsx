"use client";

import { useState } from "react";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { IconButton } from "@mui/material";
import { AuthField, type AuthFieldProps } from "./AuthField";
import { PasswordRules } from "./PasswordRules";

interface PasswordFieldProps extends Omit<AuthFieldProps, "type" | "endAdornment" | "onPaste"> {
  /** Shows the checklist of password rules under the field (new-password fields). */
  showRules?: boolean;
}

export function PasswordField({ showRules = false, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <AuthField
        {...props}
        type={visible ? "text" : "password"}
        endAdornment={
          <IconButton
            type="button"
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setVisible((v) => !v)}
            edge="end"
          >
            {visible ? <VisibilityOff /> : <Visibility />}
          </IconButton>
        }
      />
      {showRules && <PasswordRules value={props.value} />}
    </>
  );
}
