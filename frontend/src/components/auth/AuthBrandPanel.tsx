"use client";

import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { Brand } from "@/components/landing/Brand";
import { LoginVisualScene } from "./LoginVisualScene";

export type AuthPanelVariant = "login" | "recovery" | "signup";

// Message shown on the panel, one entry per route variant. New variants (recovery,
// signup, ...) are added here without touching the panel structure.
const PANEL_CONTENT: Record<AuthPanelVariant, { headline: ReactNode }> = {
  login: {
    headline: (
      <>
        Onde talentos e{" "}
        <Box component="span" sx={{ color: "primary.main" }}>
          oportunidades
        </Box>{" "}
        se encontram.
      </>
    ),
  },
  recovery: {
    headline: (
      <>
        Seu acesso de volta, com{" "}
        <Box component="span" sx={{ color: "primary.main" }}>
          segurança
        </Box>
        .
      </>
    ),
  },
  signup: {
    headline: (
      <>
        Seu próximo capítulo começa com uma{" "}
        <Box component="span" sx={{ color: "primary.main" }}>
          conexão
        </Box>
        .
      </>
    ),
  },
};

const MD = "@media (min-width: 768px)";
const LG = "@media (min-width: 1024px)";

// Brand lockup markup lives in landing/Brand; its look comes from the theme here.
const brandSx = {
  "& .tv-brand": { display: "flex", alignItems: "center", gap: "6px", [MD]: { gap: "10px" } },
  "& .tv-brand > svg": {
    flexShrink: 0,
    height: "auto",
    width: 38,
    [MD]: { width: 65 },
    "@media (min-width: 1351px)": { width: 102 },
  },
  "& .tv-brand strong": {
    display: "block",
    fontFamily: "Georgia, serif",
    fontWeight: 600,
    letterSpacing: "-0.055em",
    lineHeight: 1.1,
    fontSize: "1.25rem",
    [MD]: { fontSize: "1.5rem" },
    "@media (min-width: 1351px)": { fontSize: "2rem" },
  },
  "& .tv-brand em": { color: "secondary.main", fontStyle: "normal" },
  "& .tv-brand small": {
    display: "block",
    mt: "5px",
    color: "text.secondary",
    fontSize: "0.53rem",
    letterSpacing: "0.015em",
    [MD]: { fontSize: "0.8rem" },
  },
} as const;

interface AuthBrandPanelProps {
  variant: AuthPanelVariant;
}

// Persistent brand side of the entry screens: a compact header on mobile and a
// full-height column on desktop. Decorative content is aria-hidden.
export function AuthBrandPanel({ variant }: AuthBrandPanelProps) {
  const content = PANEL_CONTENT[variant];

  return (
    <Box
      component="aside"
      sx={{
        position: "relative",
        isolation: "isolate",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        overflow: "hidden",
        minHeight: 96,
        p: 3,
        bgcolor: "background.default",
        borderBottom: 1,
        borderColor: "divider",
        [MD]: { minHeight: 128, justifyContent: "center", px: 5 },
        [LG]: {
          minHeight: "100svh",
          justifyContent: "space-between",
          p: "clamp(40px, 5vw, 72px)",
          borderBottom: 0,
          borderRight: 1,
          borderColor: "divider",
        },
      }}
    >
      <LoginVisualScene />

      <Box sx={{ position: "relative", zIndex: 1, ...brandSx }}>
        <Brand />
      </Box>

      <Box sx={{ position: "relative", zIndex: 1, display: "none", [LG]: { display: "block" } }}>
        <Typography
          component="p"
          style={{ textWrap: "balance" }}
          sx={{
            fontSize: "clamp(1.7rem, 2.4vw, 2.4rem)",
            fontWeight: 500,
            lineHeight: 1.18,
            letterSpacing: "-0.02em",
            color: "text.primary",
            maxWidth: "22ch",
          }}
        >
          {content.headline}
        </Typography>

        <Typography
          component="p"
          sx={{
            mt: 2.5,
            fontSize: "0.8rem",
            fontWeight: 500,
            letterSpacing: "0.1em",
            color: "text.secondary",
          }}
        >
          Uma iniciativa Rio Pomba Valley
        </Typography>
      </Box>
    </Box>
  );
}
