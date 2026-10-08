"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Box } from "@mui/material";
import { AuthBackdrop } from "./AuthBackdrop";
import { AuthMotionConfig } from "./motion/AuthMotionConfig";

// Animated backdrop with the form in a card floating at the center. Also used on its own by the
// system states (404, error, access denied), which render outside the (auth) route group.
export function AuthShell({
  entrance = false,
  wide = false,
  children,
}: {
  entrance?: boolean;
  /** Wider, tighter card for the signup wizards, so their steps fit a laptop screen without scrolling. */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <AuthMotionConfig>
      <AuthBackdrop entrance={entrance} compact={wide}>
        <Box
          sx={(theme) => ({
            width: "100%",
            maxWidth: wide ? 680 : 520,
            p: 3,
            border: 1,
            borderColor: "divider",
            borderRadius: 4,
            bgcolor: `color-mix(in srgb, ${(theme.vars ?? theme).palette.background.paper} 94%, transparent)`,
            boxShadow: "0 30px 80px -30px rgb(0 0 0 / 0.5)",
            "@media (min-width: 600px)": { p: wide ? 4 : 5 },
            // Very small phones: keep as much width as before for the form content.
            "@media (max-width: 399px)": { p: 2 },
          })}
        >
          {children}
        </Box>
      </AuthBackdrop>
    </AuthMotionConfig>
  );
}

// Single layout for the entry screens. It lives in the (auth) route-group layout,
// so the backdrop stays mounted across auth routes.
export function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // /cadastro (profile choice) keeps the regular card; the wizards under it use the wide one.
  return (
    <AuthShell entrance wide={pathname.startsWith("/cadastro/")}>
      {children}
    </AuthShell>
  );
}
