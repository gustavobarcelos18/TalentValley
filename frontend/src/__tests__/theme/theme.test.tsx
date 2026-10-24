import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { Button } from "@mui/material";
import { describe, expect, it } from "vitest";
import { talentValleyTheme } from "@/theme/theme";

describe("brand button variant", () => {
  it("is opt-in: it styles only the brand variant with the gradient", () => {
    render(
      <ThemeProvider theme={talentValleyTheme}>
        <Button variant="brand">Brand</Button>
        <Button variant="contained">Default</Button>
      </ThemeProvider>,
    );
    const brand = screen.getByRole("button", { name: "Brand" });
    const standard = screen.getByRole("button", { name: "Default" });
    expect(brand.className).toContain("MuiButton-brand");
    expect(standard.className).not.toContain("MuiButton-brand");
  });

  it("exposes the surface tokens as theme variables", () => {
    const surface = talentValleyTheme.vars?.palette.surface;
    expect(surface).toBeDefined();
    for (const token of [surface?.raised, surface?.sunken, surface?.border, surface?.hover]) {
      expect(token).toContain("var(--mui-palette-surface-");
    }
  });

  it("exposes the vivid green fill as theme variables", () => {
    const vivid = talentValleyTheme.vars?.palette.vivid;
    expect(vivid).toBeDefined();
    for (const token of [vivid?.main, vivid?.dark, vivid?.contrastText]) {
      expect(token).toContain("var(--mui-palette-vivid-");
    }
  });

  it("defines its own warning color for attention highlights", () => {
    // Darker than the MUI default (#ed6c02) so the attention text keeps 4.5:1 on white.
    expect(talentValleyTheme.palette.warning.main).toBe("#B45309");
  });

  it("sets titles in the display font and body text in the base font", () => {
    for (const level of ["h1", "h2", "h3", "h4", "h5", "h6"] as const) {
      expect(talentValleyTheme.typography[level].fontFamily).toContain("--font-display");
    }
    expect(talentValleyTheme.typography.fontFamily).toContain("--font-inter");
  });

  it("lets MUI transitions follow the system reduce-motion setting", () => {
    expect(talentValleyTheme.motion.reducedMotion).toBe("system");
  });

  it("exposes the gradients as theme variables", () => {
    const gradient = talentValleyTheme.vars?.palette.gradient;
    expect(gradient).toBeDefined();
    for (const token of [gradient?.action, gradient?.actionHover, gradient?.actionContrastText, gradient?.accent]) {
      expect(token).toContain("var(--mui-palette-gradient-");
    }
  });
});
