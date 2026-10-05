import type { ReactNode, RefObject } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LandingRoot } from "@/components/landing/LandingRoot";

const hooks = vi.hoisted(() => ({
  heroDepth: vi.fn(),
  sectionStories: vi.fn(),
}));

vi.mock("@/components/landing/motion/LandingMotion", () => ({
  LandingMotion: ({ children }: { children: ReactNode }) => <div data-testid="motion">{children}</div>,
}));
vi.mock("@/components/landing/motion/useHeroDepth", () => ({ useHeroDepth: hooks.heroDepth }));
vi.mock("@/components/landing/motion/useSectionStories", () => ({ useSectionStories: hooks.sectionStories }));

const CONTENT = "conteúdo da landing";

function renderRoot() {
  return render(<LandingRoot><p>{CONTENT}</p></LandingRoot>);
}

describe("LandingRoot", () => {
  beforeEach(() => {
    hooks.heroDepth.mockReset();
    hooks.sectionStories.mockReset();
  });

  it("renders the server content inside the landing scope, inside the motion provider", () => {
    const { container } = renderRoot();
    const scope = container.querySelector(".landing");
    expect(scope?.parentElement).toBe(screen.getByTestId("motion"));
    expect(scope?.contains(screen.getByText(CONTENT))).toBe(true);
  });

  it("gives both scroll hooks the landing element as their root", () => {
    const { container } = renderRoot();
    const scope = container.querySelector(".landing");
    expect(scope).not.toBeNull();
    for (const hook of [hooks.heroDepth, hooks.sectionStories]) {
      expect(hook).toHaveBeenCalled();
      const root: RefObject<HTMLDivElement | null> = hook.mock.calls[0][0];
      expect(root.current).toBe(scope);
    }
  });
});
