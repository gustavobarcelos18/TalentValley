import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Brand } from "@/components/landing/Brand";

describe("Brand", () => {
  it("shows the wordmark and the institutional line next to the decorative mark", () => {
    const { container } = render(<Brand />);
    const wrapper = container.querySelector(".tv-brand");
    expect(wrapper?.querySelector("strong")?.textContent).toBe("Talent Valley");
    expect(wrapper?.querySelector("strong em")?.textContent).toBe("Valley");
    expect(wrapper?.querySelector("small")?.textContent).toBe("by Rio Pomba Valley");
    expect(wrapper?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
