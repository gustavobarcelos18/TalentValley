import { createTheme } from "@mui/material/styles";

export const talentValleyTheme = createTheme({
  cssVariables: {
    colorSchemeSelector: "class",
  },
  colorSchemes: {
    light: {
      palette: {
        primary: {
          main: "#7c3aed",
          light: "#a78bfa",
          dark: "#5b21b6",
          contrastText: "#ffffff",
        },
        secondary: {
          main: "#6d28d9",
          light: "#8b5cf6",
          dark: "#4c1d95",
          contrastText: "#ffffff",
        },
        background: {
          default: "#fafafa",
          paper: "#ffffff",
        },
        text: {
          primary: "#18181b",
          secondary: "#52525b",
        },
        divider: "#e4e4e7",
      },
    },
    dark: {
      palette: {
        primary: {
          main: "#a78bfa",
          light: "#c4b5fd",
          dark: "#7c3aed",
          contrastText: "#18181b",
        },
        secondary: {
          main: "#8b5cf6",
          light: "#a78bfa",
          dark: "#6d28d9",
          contrastText: "#18181b",
        },
        background: {
          default: "#09090b",
          paper: "#18181b",
        },
        text: {
          primary: "#fafafa",
          secondary: "#a1a1aa",
        },
        divider: "#27272a",
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
