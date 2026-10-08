"use client";

import Link from "next/link";
import { Box, Typography } from "@mui/material";
import { AuthFooterLink } from "@/components/auth/AuthFooterLink";

// Links under the signup screens: access for people who already have an
// account, and a way back. `inline` puts both on one row, to save height in the wizards.
export function SignupFooter({
  backHref,
  backLabel,
  inline = false,
}: {
  backHref: string;
  backLabel: string;
  inline?: boolean;
}) {
  const login = (
    <Typography align={inline ? "left" : "center"} variant="body2" color="text.secondary" sx={inline ? undefined : { mt: 3 }}>
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
  );

  if (inline) {
    return (
      <Box sx={{ mt: 2.5, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 3, rowGap: 1 }}>
        {login}
        <AuthFooterLink href={backHref} inline>
          {backLabel}
        </AuthFooterLink>
      </Box>
    );
  }

  return (
    <>
      {login}
      <AuthFooterLink href={backHref}>{backLabel}</AuthFooterLink>
    </>
  );
}
