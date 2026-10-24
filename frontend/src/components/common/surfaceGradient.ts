import type { Theme } from "@mui/material/styles";

/** Solid vivid green bar along the top edge of highlighted blocks (search, profile header, preview, selection bar). */
export function brandWash(theme: Theme): string {
  const { vivid } = (theme.vars ?? theme).palette;
  return `linear-gradient(to bottom, ${vivid.main} 0 3px, transparent 3px)`;
}
