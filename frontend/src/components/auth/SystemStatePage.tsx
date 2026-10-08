"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Alert, Button } from "@mui/material";
import { AuthFormPage } from "./AuthFormPage";
import { SystemScene, type SystemSceneKind } from "./SystemScene";

interface SystemStatePageProps {
  /** Illustration above the message. */
  scene: SystemSceneKind;
  eyebrow: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "error";
  /** Primary action: a link when `href` is given, otherwise a button. */
  action: { label: string; href: string } | { label: string; onClick: () => void };
}

// Screen for system states (404, error, access denied): a message that takes
// focus plus a single next action, inside the unified entry layout.
export function SystemStatePage({ scene, eyebrow, title, message, severity, action }: SystemStatePageProps) {
  const alertRef = useRef<HTMLDivElement | null>(null);

  // The screen replaces whatever was being shown, so move focus to the message.
  useEffect(() => {
    alertRef.current?.focus();
  }, []);

  return (
    <AuthFormPage title={title} eyebrow={eyebrow}>
      <SystemScene kind={scene} />

      <Alert
        ref={alertRef}
        tabIndex={-1}
        severity={severity}
        variant="filled"
        sx={{ fontSize: "0.9375rem" }}
      >
        {message}
      </Alert>

      {"href" in action ? (
        <Button component={Link} href={action.href} variant="contained" size="large" fullWidth>
          {action.label}
        </Button>
      ) : (
        <Button onClick={action.onClick} variant="contained" size="large" fullWidth>
          {action.label}
        </Button>
      )}
    </AuthFormPage>
  );
}
