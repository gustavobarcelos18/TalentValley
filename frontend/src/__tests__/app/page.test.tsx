import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home, { metadata, viewport } from "@/app/page";

vi.mock("@/components/landing/LandingPage", () => ({ LandingPage: () => <p>landing</p> }));

const SITE_NAME = "Talent Valley";

describe("home page", () => {
  it("renders the landing", () => {
    render(<Home />);
    expect(screen.getByText("landing")).toBeTruthy();
  });

  it("describes the page for search engines and social previews", () => {
    expect(metadata.title).toBe(SITE_NAME);
    expect(metadata.openGraph).toMatchObject({ type: "website", locale: "pt_BR", siteName: SITE_NAME, title: SITE_NAME });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image", title: SITE_NAME });
    expect(metadata.description).toBe(metadata.openGraph?.description);
  });

  it("sets the browser theme color for light and dark schemes", () => {
    expect(viewport.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: "#f6f7f2" },
      { media: "(prefers-color-scheme: dark)", color: "#0d1114" },
    ]);
  });
});
