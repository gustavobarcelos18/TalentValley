import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { Button } from "@mui/material";
import { describe, expect, it } from "vitest";
import { talentValleyTheme } from "@/theme/theme";

describe("brand button variant", () => {
  it("is opt-in: it styles only the brand variant as a pill", () => {
    render(
      <ThemeProvider theme={talentValleyTheme}>
        <Button variant="brand">Brand</Button>
        <Button variant="contained">Default</Button>
      </ThemeProvider>,
    );
    const brand = screen.getByRole("button", { name: "Brand" });
    const standard = screen.getByRole("button", { name: "Default" });
    expect(brand.className).toContain("MuiButton-brand");
    expect(getComputedStyle(brand).borderRadius).toBe("30px");
    expect(getComputedStyle(standard).borderRadius).not.toBe("30px");
  });

  it("exposes the gradients as theme variables", () => {
    const gradient = talentValleyTheme.vars?.palette.gradient;
    expect(gradient).toBeDefined();
    for (const token of [gradient?.action, gradient?.actionHover, gradient?.actionContrastText, gradient?.accent]) {
      expect(token).toContain("var(--mui-palette-gradient-");
    }
  });
});
