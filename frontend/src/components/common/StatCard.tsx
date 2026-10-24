"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { Box, Card, Typography } from "@mui/material";
import { Reveal } from "./Reveal";
import { useCountUp } from "./useCountUp";

interface StatCardProps {
  label: string;
  value: number;
  /** Material icon, decorative (the label already names the indicator). */
  icon: ReactNode;
  /** Highlights an indicator that asks for action (pending requests, for example). */
  attention?: boolean;
  /** Makes the whole card a link to the area that explains the number. */
  href?: string;
  /** Position in a group, so the entrance of the cards is staggered. */
  index?: number;
}

/** Indicator card: icon, label and a number that counts up. Zero is shown quietly unless it needs attention. */
export function StatCard({ label, value, icon, attention = false, href, index = 0 }: StatCardProps) {
  const labelId = useId();
  const shown = useCountUp(value);
  const quiet = value === 0 && !attention;

  return (
    <Reveal index={index} className="h-full">
      <Card
        {...(href
          ? { component: Link, href, "aria-label": `${label}: ${value}${attention ? " (requer atenção)" : ""}` }
          : { role: "group", "aria-labelledby": labelId })}
        sx={(theme) => {
          const palette = (theme.vars ?? theme).palette;
          return {
            height: "100%",
            padding: 2.5,
            ...(attention && { borderColor: palette.warning.main }),
            ...(href && {
              display: "block",
              color: "inherit",
              textDecoration: "none",
              transition: theme.transitions.create(["box-shadow", "transform", "border-color"], { duration: 200 }),
              "&:hover, &:focus-visible": { boxShadow: theme.shadows[3], transform: "translateY(-2px)" },
              "@media (prefers-reduced-motion: reduce)": { transition: "none", "&:hover, &:focus-visible": { transform: "none" } },
            }),
          };
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Typography id={labelId} variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography
              component="p"
              variant="h3"
              sx={{
                mt: 0.5,
                fontVariantNumeric: "tabular-nums",
                ...(quiet && { color: "text.secondary", fontWeight: 600 }),
              }}
            >
              {shown}
            </Typography>
            {attention && <span className="sr-only">Requer atenção</span>}
          </div>
          <Box
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center"
            sx={(theme) => {
              const { vivid, warning } = (theme.vars ?? theme).palette;
              return {
                borderRadius: 3,
                color: attention ? warning.contrastText : vivid.contrastText,
                backgroundColor: attention ? warning.main : vivid.main,
                opacity: quiet ? 0.6 : 1,
              };
            }}
          >
            {icon}
          </Box>
        </div>
      </Card>
    </Reveal>
  );
}
