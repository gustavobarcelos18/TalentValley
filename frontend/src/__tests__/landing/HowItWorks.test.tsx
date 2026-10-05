import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HowItWorks } from "@/components/landing/HowItWorks";

vi.mock("@/components/landing/motion/StorySteps", () => ({
  StorySteps: ({ audience }: { audience: number }) => <div data-testid="steps">{`público ${audience}`}</div>,
}));

const TALENT_TAB = "Para talentos";
const RECRUITER_TAB = "Para recrutadores";
const ARIA_SELECTED = "aria-selected";

function tab(name: string) {
  return screen.getByRole("tab", { name });
}

describe("HowItWorks", () => {
  it("offers one tab per audience, the talent one selected first", () => {
    render(<HowItWorks />);
    expect(screen.getByRole("tablist", { name: "Como funciona para cada público" })).toBeTruthy();
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(tab(TALENT_TAB).getAttribute(ARIA_SELECTED)).toBe("true");
    expect(tab(RECRUITER_TAB).getAttribute(ARIA_SELECTED)).toBe("false");
    expect(screen.getByTestId("steps").textContent).toBe("público 0");
  });

  it("links both tabs to the shared steps panel", () => {
    render(<HowItWorks />);
    expect(tab(TALENT_TAB).id).toBe("how-tab-0");
    expect(tab(RECRUITER_TAB).id).toBe("how-tab-1");
    expect(tab(TALENT_TAB).getAttribute("aria-controls")).toBe("how-panel");
    expect(tab(RECRUITER_TAB).getAttribute("aria-controls")).toBe("how-panel");
  });

  it("switches the steps to the chosen audience and back", async () => {
    const user = userEvent.setup();
    render(<HowItWorks />);

    await user.click(tab(RECRUITER_TAB));
    expect(tab(RECRUITER_TAB).getAttribute(ARIA_SELECTED)).toBe("true");
    expect(tab(TALENT_TAB).getAttribute(ARIA_SELECTED)).toBe("false");
    expect(screen.getByTestId("steps").textContent).toBe("público 1");

    await user.click(tab(TALENT_TAB));
    expect(tab(TALENT_TAB).getAttribute(ARIA_SELECTED)).toBe("true");
    expect(screen.getByTestId("steps").textContent).toBe("público 0");
  });
});
