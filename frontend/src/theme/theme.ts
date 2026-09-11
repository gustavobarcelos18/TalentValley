import { createTheme } from "@mui/material/styles";

export const talentValleyTheme = createTheme({
  cssVariables: true,
  palette: {
    primary: {
      main: "#00695c",
    },
    secondary: {
      main: "#f9a825",
    },
    background: {
      default: "#f8fafc",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: "var(--font-geist-sans), Arial, sans-serif",
    h3: {
      fontWeight: 700,
    },
  },
  shape: {
    borderRadius: 12,
  },
});
