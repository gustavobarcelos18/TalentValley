import { createTheme } from "@mui/material/styles";

interface BrandGradients {
  /** Primary call to action of the public landing and entry screens. */
  action: string;
  actionHover: string;
  actionContrastText: string;
  /** Highlighted words inside headings. */
  accent: string;
}

declare module "@mui/material/styles" {
  interface Palette {
    gradient: BrandGradients;
  }
  interface PaletteOptions {
    gradient?: BrandGradients;
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

export const talentValleyTheme = createTheme({
  cssVariables: {
    colorSchemeSelector: "class",
  },
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
        background: {
          default: "#F6F7F2",
          paper: "#ffffff",
        },
        text: {
          primary: "#15201D",
          secondary: "#53605C",
        },
        divider: "#D5DDD4",
        gradient: { ...actionGradients, accent: "linear-gradient(100deg, #008652, #52832e)" },
      },
    },
    dark: {
      palette: {
        primary: {
          main: "#A0D060",
          light: "#C0E394",
          dark: "#007D32",
          contrastText: "#15201D",
        },
        secondary: {
          main: "#20C8C0",
          light: "#A0D060",
          dark: "#007D73",
          contrastText: "#15201D",
        },
        background: {
          default: "#0D1114",
          paper: "#12171B",
        },
        text: {
          primary: "#F4F7F6",
          secondary: "#A8B2B0",
        },
        divider: "#273238",
        gradient: { ...actionGradients, accent: "linear-gradient(100deg, #35dc90, #8cba53)" },
      },
    },
  },
  typography: {
    fontFamily: "var(--font-inter), system-ui, -apple-system, sans-serif",
    h3: {
      fontWeight: 700,
      letterSpacing: "-0.025em",
    },
    h4: {
      fontWeight: 700,
      letterSpacing: "-0.025em",
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: "10px 20px",
        },
      },
      // Opt-in look for the public landing and entry screens; internal screens keep the default buttons.
      variants: [
        {
          props: { variant: "brand" },
          style: ({ theme }) => {
            const { gradient } = (theme.vars ?? theme).palette;
            return {
              borderRadius: 30,
              background: gradient.action,
              // Doubled selector: the button is usually a link, and plain `a { color: inherit }` rules would win.
              "&&": { color: gradient.actionContrastText },
              "&:hover": { background: gradient.actionHover },
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
    MuiDialogContent: {
      styleOverrides: {
        root: {
          "&&:not(.MuiDialogContent-dividers)": {
            paddingTop: 24,
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
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
