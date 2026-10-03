import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "inter-var" }),
  Manrope: () => ({ variable: "display-var" }),
}));
vi.mock("@/theme/ThemeRegistry", () => ({ ThemeRegistry: ({ children }: { children: ReactNode }) => <div id="theme">{children}</div> }));
vi.mock("@/components/auth/AuthProvider", () => ({ AuthProvider: ({ children }: { children: ReactNode }) => <div id="auth">{children}</div> }));

async function loadLayout() {
  vi.resetModules();
  return import("@/app/layout");
}

describe("root layout", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("wraps the page with the theme and the auth provider in pt-BR", async () => {
    const { default: RootLayout } = await loadLayout();
    const props = { children: <p>conteúdo</p>, params: Promise.resolve({}) } as Parameters<typeof RootLayout>[0];
    const markup = renderToStaticMarkup(RootLayout(props));
    expect(markup).toContain('lang="pt-BR"');
    expect(markup).toContain("inter-var display-var");
    expect(markup).toContain('<div id="theme"><div id="auth"><p>conteúdo</p></div></div>');
  });

  it("falls back to localhost when the site URL is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", undefined);
    const { metadata } = await loadLayout();
    expect(String(metadata.metadataBase)).toBe("http://localhost:3000/");
    expect(metadata.title).toBe("Talent Valley");
  });

  it("uses the configured site URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://talentvalley.example");
    const { metadata } = await loadLayout();
    expect(String(metadata.metadataBase)).toBe("https://talentvalley.example/");
  });
});
