"use client";

import Link from "next/link";
import ArrowBack from "@mui/icons-material/ArrowBack";
import { Box, Typography } from "@mui/material";

// Secondary link under an entry screen, e.g. back to the login.
export function AuthFooterLink({ href, children }: { href: string; children: string }) {
  return (
    <Box sx={{ textAlign: "center", mt: 4 }}>
      <Typography
        component={Link}
        href={href}
        variant="body2"
        sx={{
          color: "text.secondary",
          display: "inline-flex",
          alignItems: "center",
          gap: 0.75,
          transition: "color 0.2s",
          "&:hover": { color: "text.primary" },
        }}
      >
        <ArrowBack sx={{ fontSize: "1rem" }} />
        {children}
      </Typography>
    </Box>
  );
}
