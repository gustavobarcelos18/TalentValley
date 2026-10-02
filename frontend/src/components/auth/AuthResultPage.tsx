"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { Alert, Button } from "@mui/material";
import { AuthFormPage } from "./AuthFormPage";

interface AuthResultPageProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  severity: "success" | "error";
  message: string;
  actionHref: string;
  actionLabel: string;
  footer?: ReactNode;
}

// Screen that replaces a form with its outcome (success or invalid link): a
// message that takes focus plus a single next action.
export function AuthResultPage({
  title,
  subtitle,
  eyebrow,
  severity,
  message,
  actionHref,
  actionLabel,
  footer,
}: AuthResultPageProps) {
  const alertRef = useRef<HTMLDivElement | null>(null);

  // The form that was on screen is gone, so move focus to the message.
  useEffect(() => {
    alertRef.current?.focus();
  }, []);

  return (
    <AuthFormPage title={title} subtitle={subtitle} eyebrow={eyebrow} footer={footer}>
      <Alert
        ref={alertRef}
        tabIndex={-1}
        severity={severity}
        variant="filled"
        sx={{ fontSize: "0.9375rem" }}
      >
        {message}
      </Alert>

      <Button component={Link} href={actionHref} variant="contained" size="large" fullWidth>
        {actionLabel}
      </Button>
    </AuthFormPage>
  );
}
