import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import Image, { alt, contentType, size } from "@/app/opengraph-image";

vi.mock("next/og", () => ({
  ImageResponse: class {
    constructor(
      public element: ReactElement,
      public options: { width: number; height: number },
    ) {}
  },
}));

describe("opengraph image", () => {
  it("declares the image metadata", () => {
    expect(alt).toBe("Talent Valley: Talento encontra oportunidade aqui.");
    expect(size).toEqual({ width: 1200, height: 630 });
    expect(contentType).toBe("image/png");
  });

  it("draws the brand and the tagline at the declared size", () => {
    const response = Image() as unknown as { element: ReactElement; options: typeof size };
    expect(response.options).toBe(size);
    const markup = renderToStaticMarkup(response.element);
    expect(markup).toContain("Talent");
    expect(markup).toContain(">Valley</span>");
    expect(markup).toContain("Talento encontra oportunidade aqui.");
  });
});
