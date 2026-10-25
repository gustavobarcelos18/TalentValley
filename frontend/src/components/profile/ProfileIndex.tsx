"use client";

import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { DEMO_BANNER_HEIGHT_VAR } from "@/components/demo/bannerHeight";
import { PROFILE_BLOCKS, profileSectionAnchor, type ProfileSectionId } from "./profileSections";

const BANNER_OFFSET = `var(${DEMO_BANNER_HEIGHT_VAR}, 0px)`;
// Height of the phone's top bar (see AppShell), only shown below `lg`.
const TOP_BAR_HEIGHT = 64;
// Height of the chip bar, with a little air below it.
const CHIP_BAR_HEIGHT = 72;
const PAGE_GAP = 16;
const SIDE_LIST_GAP = 24;

/** Space the sticky index takes at the top of the page, so a section reached by the index is not hidden under it. */
export const SECTION_SCROLL_MARGIN = {
  xs: `calc(${BANNER_OFFSET} + ${TOP_BAR_HEIGHT + CHIP_BAR_HEIGHT}px)`,
  lg: `calc(${BANNER_OFFSET} + ${PAGE_GAP + CHIP_BAR_HEIGHT}px)`,
  xl: `calc(${BANNER_OFFSET} + ${SIDE_LIST_GAP}px)`,
};

const SECTION_IDS = PROFILE_BLOCKS.flatMap((block) => block.sections.map((section) => section.id));

// The section crossing a band near the top of the screen is the one being read.
function useVisibleSection(): ProfileSectionId {
  const [visible, setVisible] = useState<ProfileSectionId>(SECTION_IDS[0]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const inBand = new Set<ProfileSectionId>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = SECTION_IDS.find((sectionId) => profileSectionAnchor(sectionId) === entry.target.id);
          if (!id) continue;
          if (entry.isIntersecting) inBand.add(id);
          else inBand.delete(id);
        }
        const first = SECTION_IDS.find((id) => inBand.has(id));
        if (first) setVisible(first);
      },
      { rootMargin: "-15% 0px -65% 0px" },
    );
    for (const id of SECTION_IDS) {
      const element = document.getElementById(profileSectionAnchor(id));
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  return visible;
}

// Index of the profile page. Below `xl` it is a sticky row of chips under the top bar;
// from `xl` on it is a sticky side list that shows the three blocks. Plain links, so the
// keyboard and screen readers work with no extra code.
export function ProfileIndex() {
  const visible = useVisibleSection();
  const [clicked, setClicked] = useState<ProfileSectionId | null>(null);
  const current = clicked ?? visible;

  // The first scroll the reader makes (wheel, touch, scroll bar or keys) takes over from the last click.
  useEffect(() => {
    if (!clicked) return;
    const release = () => setClicked(null);
    const events = ["wheel", "touchmove", "pointerdown", "keydown"] as const;
    for (const name of events) window.addEventListener(name, release, { passive: true, once: true });
    return () => {
      for (const name of events) window.removeEventListener(name, release);
    };
  }, [clicked]);

  return (
    <Box
      component="nav"
      aria-label="Seções do perfil"
      sx={(theme) => {
        const { background, divider } = (theme.vars ?? theme).palette;
        return {
          position: "sticky",
          zIndex: 1,
          top: {
            xs: `calc(${BANNER_OFFSET} + ${TOP_BAR_HEIGHT}px)`,
            lg: `calc(${BANNER_OFFSET} + ${PAGE_GAP}px)`,
            xl: `calc(${BANNER_OFFSET} + ${SIDE_LIST_GAP}px)`,
          },
          alignSelf: "start",
          bgcolor: { xs: background.default, xl: "transparent" },
          borderBottom: { xs: `1px solid ${divider}`, xl: "none" },
          mx: { xs: -2, sm: -3, lg: 0 },
          px: { xs: 2, sm: 3, lg: 0 },
          py: { xs: 1, xl: 0 },
          mb: { xs: 2.5, xl: 0 },
          overflowX: { xs: "auto", xl: "visible" },
        };
      }}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "row", xl: "column" },
          gap: { xs: 1, xl: 3 },
          width: { xs: "max-content", xl: "auto" },
        }}
      >
        {PROFILE_BLOCKS.map((block) => (
          <Box key={block.title} sx={{ display: { xs: "contents", xl: "block" } }}>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: { xs: "none", xl: "block" }, mb: 0.5, lineHeight: 1.6 }}
            >
              {block.title}
            </Typography>
            <Box
              component="ul"
              sx={{
                display: "flex",
                flexDirection: { xs: "row", xl: "column" },
                gap: { xs: 1, xl: 0 },
                listStyle: "none",
                m: 0,
                p: 0,
              }}
            >
              {block.sections.map((section) => {
                const active = current === section.id;
                return (
                  <li key={section.id}>
                    <IndexLink
                      href={`#${profileSectionAnchor(section.id)}`}
                      active={active}
                      onClick={() => setClicked(section.id)}
                    >
                      {section.label}
                    </IndexLink>
                  </li>
                );
              })}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

interface IndexLinkProps {
  href: string;
  active: boolean;
  onClick: () => void;
  children: string;
}

function IndexLink({ href, active, onClick, children }: Readonly<IndexLinkProps>) {
  return (
    <Box
      component="a"
      href={href}
      onClick={onClick}
      aria-current={active ? "location" : undefined}
      sx={(theme) => {
        const { vivid, divider, text, primary } = (theme.vars ?? theme).palette;
        return {
          display: "block",
          whiteSpace: "nowrap",
          textDecoration: "none",
          typography: "body2",
          fontWeight: active ? 700 : 500,
          color: active ? { xs: vivid.contrastText, xl: text.primary } : text.secondary,
          bgcolor: { xs: active ? vivid.main : "transparent", xl: "transparent" },
          border: { xs: `1px solid ${active ? vivid.main : divider}`, xl: "none" },
          borderRadius: { xs: 99, xl: 0 },
          px: 1.5,
          py: { xs: 0.5, xl: 0.75 },
          borderLeft: { xl: `3px solid ${active ? vivid.main : "transparent"}` },
          "&:hover": { color: active ? undefined : text.primary },
          "&:focus-visible": { outline: `2px solid ${primary.main}`, outlineOffset: { xs: -2, xl: 2 } },
        };
      }}
    >
      {children}
    </Box>
  );
}
