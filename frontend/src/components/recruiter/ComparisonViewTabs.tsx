"use client";

import Link from "next/link";
import { Box, Tab, Tabs } from "@mui/material";
import { COMPARISON_PATH, COMPARISON_TABLE_PATH, comparisonHref, type ComparisonSlugs } from "@/lib/comparison";

export type ComparisonView = "atual" | "tabela";

// Switches between the two comparison views. Each tab is a link that carries the same two slugs.
export function ComparisonViewTabs({ slugs, active }: { slugs: ComparisonSlugs; active: ComparisonView }) {
  return (
    <Box component="nav" aria-label="Visualização da comparação" sx={{ alignSelf: "flex-start", maxWidth: "100%" }}>
      <Tabs
        value={active}
        variant="scrollable"
        scrollButtons={false}
        sx={(theme) => {
          const { divider, surface, vivid } = (theme.vars ?? theme).palette;
          return {
            minHeight: 44,
            p: 0.5,
            border: `1px solid ${divider}`,
            borderRadius: 4,
            backgroundColor: surface.raised,
            "& .MuiTabs-indicator": { display: "none" },
            "& .MuiTab-root": { minHeight: 36, px: 2.5, borderRadius: 4, fontWeight: 600 },
            "& .MuiTab-root:not(.Mui-selected):hover": { backgroundColor: surface.hover },
            "& .MuiTab-root.Mui-selected": { color: vivid.contrastText, backgroundColor: vivid.main },
          };
        }}
      >
        <Tab
          component={Link}
          href={comparisonHref(COMPARISON_PATH, slugs)}
          value="atual"
          label="Comparação atual"
          aria-current={active === "atual" ? "page" : undefined}
        />
        <Tab
          component={Link}
          href={comparisonHref(COMPARISON_TABLE_PATH, slugs)}
          value="tabela"
          label="Tabela de currículos"
          aria-current={active === "tabela" ? "page" : undefined}
        />
      </Tabs>
    </Box>
  );
}
