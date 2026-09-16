"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { CssBaseline, ThemeProvider } from "@mui/material";
import type { ReactNode } from "react";
import { talentValleyTheme } from "./theme";

type ThemeRegistryProps = {
  children: ReactNode;
};

export function ThemeRegistry({ children }: ThemeRegistryProps) {
  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={talentValleyTheme} defaultMode="dark" disableTransitionOnChange>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
