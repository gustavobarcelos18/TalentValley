import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthFooterLink } from "@/components/auth/AuthFooterLink";

describe("AuthFooterLink", () => {
  it("links to the given href with the given text and a decorative arrow", () => {
    render(<AuthFooterLink href="/login">Voltar ao login</AuthFooterLink>);

    const link = screen.getByRole("link", { name: "Voltar ao login" });
    expect(link.getAttribute("href")).toBe("/login");
    expect(link.querySelector("svg")).not.toBeNull();
  });

  it("is centered with a top margin by default", () => {
    render(<AuthFooterLink href="/login">Voltar</AuthFooterLink>);

    const wrapper = screen.getByRole("link").parentElement as HTMLElement;
    expect(wrapper.className).toContain("MuiBox-root");
    expect(getComputedStyle(wrapper).textAlign).toBe("center");
    expect(getComputedStyle(wrapper).marginTop).toBe("32px");
  });

  it("drops the centering and the margin when inline", () => {
    render(<AuthFooterLink href="/login" inline>Voltar</AuthFooterLink>);

    const wrapper = screen.getByRole("link").parentElement as HTMLElement;
    expect(getComputedStyle(wrapper).textAlign).not.toBe("center");
    expect(getComputedStyle(wrapper).marginTop).not.toBe("32px");
  });
});
