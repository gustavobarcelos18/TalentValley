"use client";

import Link from "next/link";
import ArrowBack from "@mui/icons-material/ArrowBack";
import { Box, Typography } from "@mui/material";

// Secondary link under an entry screen, e.g. back to the login. `inline` drops the centering and the
// top margin, for a link that shares a row with another one.
export function AuthFooterLink({
  href,
  inline = false,
  children,
}: {
  href: string;
  inline?: boolean;
  children: string;
}) {
  return (
    <Box sx={inline ? undefined : { textAlign: "center", mt: 4 }}>
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
