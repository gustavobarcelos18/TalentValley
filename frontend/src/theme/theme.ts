import { createTheme, type PaletteOptions, type Shadows, type Theme } from "@mui/material/styles";

interface BrandGradients {
  /** Primary call to action of the public landing and entry screens. */
  action: string;
  actionHover: string;
  actionContrastText: string;
  /** Highlighted words inside headings. */
  accent: string;
}

interface SurfaceTokens {
  /** Cards and panels placed on top of the page background. */
  raised: string;
  /** Wells and inset areas, darker than the page background. */
  sunken: string;
  /** Visible outline of cards and inputs (stronger than `divider`). */
  border: string;
  /** Background of rows and cards under the pointer. */
  hover: string;
}

interface VividColor {
  main: string;
  /** Hover of a vivid fill. */
  dark: string;
  /** Text and icons placed on top of a vivid fill. */
  contrastText: string;
}

declare module "@mui/material/styles" {
  interface Palette {
    gradient: BrandGradients;
    surface: SurfaceTokens;
    /** Bright brand green for solid fills (buttons, chips, icon tiles). It is the same in both schemes. */
    vivid: VividColor;
  }
  interface PaletteOptions {
    gradient?: BrandGradients;
    surface?: SurfaceTokens;
    vivid?: VividColor;
  }
}

declare module "@mui/material/Button" {
  interface ButtonPropsVariantOverrides {
    brand: true;
  }
}

const actionGradients = {
  action: "linear-gradient(100deg, #4afb8d, #09b8b6)",
  actionHover: "linear-gradient(100deg, #79ffa8, #21d0c7)",
  actionContrastText: "#081d17",
};

/** Titles use Manrope (`--font-display`, loaded in the root layout); body text keeps Inter. */
const displayFont = "var(--font-display), var(--font-inter), system-ui, -apple-system, sans-serif";

/** Deep black of the dark scheme: page, panels, text, dividers and the surface tokens. */
const darkNeutrals = {
  background: { default: "#0A0B0C", paper: "#131517" },
  text: { primary: "#F4F7F6", secondary: "#8F9A96" },
  divider: "#2A2E31",
  surface: { raised: "#131517", sunken: "#050606", border: "#6F7A76", hover: "#1C1F22" },
} satisfies PaletteOptions;

/** Solid brand green with dark text, used on buttons, chips and icon tiles in both schemes. */
const vivid = { main: "#3DDC84", dark: "#2FC472", contrastText: "#03210F" } satisfies VividColor;

const baseShadows = createTheme().shadows;

/** Soft, low-contrast elevations. Dark mode leans on borders, so the same shadows work in both schemes. */
const shadows = [...baseShadows] as Shadows;
shadows[1] = "0 1px 2px rgb(16 24 20 / 0.06), 0 1px 1px rgb(16 24 20 / 0.04)";
shadows[2] = "0 2px 6px rgb(16 24 20 / 0.08), 0 1px 2px rgb(16 24 20 / 0.05)";
shadows[3] = "0 6px 16px rgb(16 24 20 / 0.10), 0 2px 4px rgb(16 24 20 / 0.06)";
shadows[4] = "0 12px 28px rgb(16 24 20 / 0.16), 0 4px 8px rgb(16 24 20 / 0.08)";

const palette = (theme: Theme) => (theme.vars ?? theme).palette;

export const talentValleyTheme = createTheme({
  cssVariables: {
    colorSchemeSelector: "class",
  },
  // MUI transitions (drawer, menu, dialog, ripple) follow the system "reduce motion" setting.
  motion: { reducedMotion: "system" },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: "#007D32",
          light: "#A0D060",
          dark: "#005F26",
          contrastText: "#ffffff",
        },
        secondary: {
          main: "#007D73",
          light: "#20C8C0",
          dark: "#005E57",
          contrastText: "#ffffff",
        },
        warning: {
          main: "#B45309",
          light: "#D97706",
          dark: "#92400E",
          contrastText: "#ffffff",
        },
        background: {
          default: "#F6F7F2",
          paper: "#ffffff",
        },
        text: {
          primary: "#15201D",
          secondary: "#4A5753",
        },
        divider: "#D5DDD4",
        surface: { raised: "#ffffff", sunken: "#EBF0E8", border: "#8A978C", hover: "#EFF4EC" },
        gradient: { ...actionGradients, accent: "linear-gradient(100deg, #008652, #52832e)" },
        vivid,
      },
    },
    dark: {
      palette: {
        primary: {
          main: "#3DDC84",
          light: "#7BE8AB",
          dark: "#2FC472",
          contrastText: "#03210F",
        },
        secondary: {
          main: "#20C8C0",
          light: "#7BE8AB",
          dark: "#007D73",
          contrastText: "#15201D",
        },
        warning: {
          main: "#FBBF24",
          light: "#FCD34D",
          dark: "#D97706",
          contrastText: "#1A1203",
        },
        ...darkNeutrals,
        gradient: { ...actionGradients, accent: "linear-gradient(100deg, #35dc90, #8cba53)" },
        vivid,
      },
    },
  },
  typography: {
    fontFamily: "var(--font-inter), system-ui, -apple-system, sans-serif",
    h1: { fontFamily: displayFont, fontWeight: 800, letterSpacing: "-0.03em" },
    h2: { fontFamily: displayFont, fontWeight: 800, letterSpacing: "-0.03em" },
    h3: { fontFamily: displayFont, fontWeight: 700, letterSpacing: "-0.025em" },
    h4: { fontFamily: displayFont, fontWeight: 700, letterSpacing: "-0.025em" },
    h5: { fontFamily: displayFont, fontWeight: 600, letterSpacing: "-0.015em" },
    h6: { fontFamily: displayFont, fontWeight: 600, letterSpacing: "-0.01em" },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 1,
  },
  shadows,
  // Native MUI keyboard focus ring (2px, primary color); it moves inside menu items and tabs so it is not clipped.
  focusVisible: true,
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 4,
          padding: "10px 20px",
        },
      },
      // Opt-in look for the public landing and entry screens; internal screens keep the default buttons.
      variants: [
        // Solid primary buttons use the vivid green with dark text (the plain primary is kept for text, borders and focus).
        {
          props: { variant: "contained", color: "primary" },
          style: ({ theme }) => {
            const { vivid: fill } = palette(theme);
            return {
              "&:not(.Mui-disabled)": {
                backgroundColor: fill.main,
                color: fill.contrastText,
                "&:hover": { backgroundColor: fill.dark },
              },
            };
          },
        },
        {
          props: { variant: "brand" },
          style: ({ theme }) => {
            const { gradient } = palette(theme);
            return {
              borderRadius: 4,
              background: gradient.action,
              // Doubled selector: the button is usually a link, and plain `a { color: inherit }` rules would win.
              "&&": { color: gradient.actionContrastText },
              "&:hover": { background: gradient.actionHover },
            };
          },
        },
      ],
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          fontWeight: 600,
        },
      },
      // Primary chips (filled or outlined) are solid vivid green with dark text.
      variants: [
        {
          props: { color: "primary" },
          style: ({ theme }) => {
            const { vivid: fill } = palette(theme);
            return {
              backgroundColor: fill.main,
              color: fill.contrastText,
              borderColor: fill.main,
              "& .MuiChip-icon": { color: "inherit" },
              "&.MuiChip-clickable:hover": { backgroundColor: fill.dark },
            };
          },
        },
      ],
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
        size: "small",
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 4,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: palette(theme).surface.border,
          },
        }),
      },
    },
    MuiCard: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 4,
          border: `1px solid ${palette(theme).divider}`,
          backgroundColor: palette(theme).surface.raised,
          boxShadow: theme.shadows[1],
        }),
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRadius: 4,
          border: `1px solid ${palette(theme).divider}`,
          boxShadow: theme.shadows[4],
        }),
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          "&&:not(.MuiDialogContent-dividers)": {
            paddingTop: 24,
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 4,
          transition: theme.transitions.create(["background-color", "color"], { duration: 150 }),
          "&:hover, &.Mui-selected, &.Mui-selected:hover": { backgroundColor: palette(theme).surface.hover },
        }),
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiSkeleton: {
      defaultProps: {
        animation: "wave",
      },
      styleOverrides: {
        root: {
          // The shimmer is decorative: "reduce motion" turns it into a still placeholder.
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
            "&::after": { animation: "none" },
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarGutter: "stable",
        },
      },
    },
  },
});
