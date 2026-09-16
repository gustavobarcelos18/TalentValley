import { createTheme } from "@mui/material/styles";

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
