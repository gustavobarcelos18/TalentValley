"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Box } from "@mui/material";
import { AuthBrandPanel, type AuthPanelVariant } from "./AuthBrandPanel";

// Routes already migrated to the unified entry layout. A route not listed here
// still renders its own shell, so screens can move over one phase at a time.
const PANEL_VARIANT_BY_PATH: Record<string, AuthPanelVariant> = {
  "/login": "login",
  "/esqueci-senha": "recovery",
  "/redefinir-senha": "recovery",
  "/ativar-conta": "recovery",
  "/reenviar-ativacao": "recovery",
  "/cadastro": "signup",
  "/cadastro/aluno": "signup",
  "/cadastro/recrutador": "signup",
};

// Brand panel + form area. Also used on its own by the system states (404, error,
// access denied), which render outside the (auth) route group.
export function AuthShell({ variant, children }: { variant: AuthPanelVariant; children: ReactNode }) {
  return (
    <Box
      component="main"
      className="grid min-h-svh grid-rows-[auto_1fr] lg:grid-cols-[54%_46%] lg:grid-rows-1"
      sx={{ bgcolor: "background.default", color: "text.primary", overflowX: "clip" }}
    >
      <AuthBrandPanel variant={variant} />

      <Box
        component="section"
        className="flex items-center justify-center px-5 pt-8 pb-12 lg:px-[clamp(40px,5vw,80px)] lg:py-12"
      >
        <div className="w-full max-w-[440px]">{children}</div>
      </Box>
    </Box>
  );
}

// Single layout for the entry screens. It lives in the (auth) route-group layout,
// so the panel stays mounted across auth routes.
export function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const variant = PANEL_VARIANT_BY_PATH[pathname];

  if (!variant) {
    return <>{children}</>;
  }

  return <AuthShell variant={variant}>{children}</AuthShell>;
}
