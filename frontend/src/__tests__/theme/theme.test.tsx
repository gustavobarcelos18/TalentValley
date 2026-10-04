import { useTheme } from "@mui/material/styles";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemeRegistry } from "@/theme/ThemeRegistry";
import { talentValleyTheme } from "@/theme/theme";

type SchemeTheme = { colorSchemes: Record<"light" | "dark", { palette: { primary: { main: string } } }> };
const schemes = (talentValleyTheme as unknown as SchemeTheme).colorSchemes;

describe("talentValleyTheme", () => {
  it("defines the light and dark brand palettes", () => {
    expect(schemes.light.palette.primary.main).toBe("#007D32");
    expect(schemes.dark.palette.primary.main).toBe("#A0D060");
  });

  it("keeps the shared shape, button and field defaults", () => {
    expect(talentValleyTheme.shape.borderRadius).toBe(12);
    expect(talentValleyTheme.typography.button.textTransform).toBe("none");
    expect(talentValleyTheme.components?.MuiTextField?.defaultProps).toEqual({ variant: "outlined", size: "small" });
  });
});

describe("ThemeRegistry", () => {
  it("gives its children the Talent Valley theme", () => {
    function Radius() {
      return <p>{useTheme().shape.borderRadius}</p>;
    }

    render(
      <ThemeRegistry>
        <Radius />
      </ThemeRegistry>,
    );

    expect(screen.getByText("12")).toBeTruthy();
  });
});
