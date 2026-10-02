"use client";

import Link from "next/link";
import { Typography } from "@mui/material";
import { AuthFooterLink } from "@/components/auth/AuthFooterLink";

// Links under the signup screens: access for people who already have an
// account, and a way back.
export function SignupFooter({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <>
      <Typography align="center" variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        Já possui acesso?{" "}
        <Typography
          component={Link}
          href="/login"
          variant="body2"
          sx={{ color: "primary.main", fontWeight: 600, "&:hover": { textDecoration: "underline" } }}
        >
          Entrar na plataforma
        </Typography>
      </Typography>

      <AuthFooterLink href={backHref}>{backLabel}</AuthFooterLink>
    </>
  );
}
