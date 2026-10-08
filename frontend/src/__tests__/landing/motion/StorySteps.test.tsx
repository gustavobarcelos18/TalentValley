import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LandingMotion } from "@/components/landing/motion/LandingMotion";
import { StorySteps } from "@/components/landing/motion/StorySteps";
import { motionCalls, presenceCalls, resetMotionCalls } from "./framerMotionMock";
import { stubLandingMedia, type LandingMedia } from "./landingMedia";

vi.mock("framer-motion", () => import("./framerMotionMock"));

type Variant = { opacity?: number; y?: number; scaleX?: number; transition?: { duration?: number; staggerChildren?: number } };
type Variants = { hidden: Variant; visible: Variant };

const TALENT_AUDIENCE = 0;
const COMPANY_AUDIENCE = 1;
const TALENT_TITLES = ["Solicite seu cadastro", "Monte seu perfil", "Seja encontrado"];
const COMPANY_TITLES = ["Solicite seu acesso", "Encontre talentos", "Conheça a trajetória"];

function renderSteps(policy: LandingMedia | null, audience = TALENT_AUDIENCE) {
  if (policy === null) return render(<StorySteps audience={audience} />);
  stubLandingMedia(policy);
  return render(<LandingMotion><StorySteps audience={audience} /></LandingMotion>);
}

function lastCalls(tag: string, count: number) {
  return motionCalls.filter((entry) => entry.tag === tag).slice(-count).map((entry) => entry.props);
}

type ListProps = {
  initial: string | false;
  whileInView: string;
  viewport: { once: boolean; amount: number };
  variants: Variants;
  exit: { opacity: number; transition: { duration: number } };
};

function listProps() {
  const [props] = lastCalls("ol", 1);
  return props as ListProps;
}

function itemVariants() {
  const calls = lastCalls("li", 3);
  expect(calls).toHaveLength(3);
  return calls.map((props) => props.variants as Variants);
}

function connectionVariants() {
  const calls = lastCalls("span", 3);
  expect(calls).toHaveLength(3);
  return calls.map((props) => props.variants as Variants);
}

function panel() {
  return screen.getByRole("tabpanel");
}

function panelTitles() {
  return within(panel()).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
}

describe("StorySteps", () => {
  beforeEach(() => {
    resetMotionCalls();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the three steps of the selected audience in an accessible tab panel", () => {
    renderSteps("desktop", TALENT_AUDIENCE);

    expect(panel().id).toBe("how-panel");
    expect(panel().getAttribute("aria-labelledby")).toBe("how-tab-0");
    expect(panel().tabIndex).toBe(0);
    expect(panelTitles()).toEqual(TALENT_TITLES);
    expect(within(panel()).getByText("Apresente formação, competências, projetos e experiências.")).toBeTruthy();
    expect(within(panel()).getAllByText(/^0[1-3]$/).map((number) => number.textContent)).toEqual(["01", "02", "03"]);
  });

  it("shows the company steps when the audience changes", () => {
    const { rerender } = render(<StorySteps audience={TALENT_AUDIENCE} />);
    rerender(<StorySteps audience={COMPANY_AUDIENCE} />);

    expect(panel().getAttribute("aria-labelledby")).toBe("how-tab-1");
    expect(panelTitles()).toEqual(COMPANY_TITLES);
  });

  it("keeps both step groups in the DOM, hidden and inert, to reserve the larger panel", () => {
    renderSteps("desktop", TALENT_AUDIENCE);

    const measures = document.querySelectorAll("ol.steps-measure");
    expect(measures).toHaveLength(2);
    measures.forEach((measure) => {
      expect(measure.getAttribute("aria-hidden")).toBe("true");
      expect(measure.hasAttribute("inert")).toBe(true);
    });
    expect(Array.from(measures[1].querySelectorAll("h3")).map((heading) => heading.textContent)).toEqual(COMPANY_TITLES);
    expect(panel().querySelector(".steps-measure")).toBeNull();
  });

  it("waits for the exiting panel before showing the next one, without animating the first render", () => {
    renderSteps("desktop");
    expect(presenceCalls.at(-1)).toEqual({ mode: "wait", initial: false });
  });

  it("staggers the steps in from the hidden state once they scroll into view on desktop", () => {
    renderSteps("desktop");

    const list = listProps();
    expect(list.initial).toBe("hidden");
    expect(list.whileInView).toBe("visible");
    expect(list.viewport).toEqual({ once: true, amount: 0.15 });
    expect(list.exit).toEqual({ opacity: 0, transition: { duration: 0.12 } });
    expect(list.variants.hidden).toEqual({ opacity: 1 });
    expect(list.variants.visible.transition?.staggerChildren).toBe(0.2);
    itemVariants().forEach((variants) => {
      expect(variants.hidden).toEqual({ opacity: 0, y: 12 });
      expect(variants.visible).toEqual({ opacity: 1, y: 0, transition: { duration: 0.45 } });
    });
    connectionVariants().forEach((variants) => {
      expect(variants.hidden).toEqual({ scaleX: 0 });
      expect(variants.visible).toEqual({ scaleX: 1, transition: { duration: 0.5 } });
    });
  });

  it("uses a tighter stagger and shorter offset on mobile", () => {
    renderSteps("mobile");

    const list = listProps();
    expect(list.initial).toBe("hidden");
    expect(list.exit.transition.duration).toBe(0.12);
    expect(list.variants.visible.transition?.staggerChildren).toBe(0.08);
    itemVariants().forEach((variants) => {
      expect(variants.hidden.y).toBe(6);
      expect(variants.visible.transition?.duration).toBe(0.45);
    });
    connectionVariants().forEach((variants) => expect(variants.visible.transition?.duration).toBe(0.5));
  });

  it.each<[string, LandingMedia | null]>([
    ["before the policy is known", null],
    ["with reduced motion", "reduced"],
  ])("renders the steps without entrance animation %s", (_label, policy) => {
    renderSteps(policy);

    const list = listProps();
    expect(list.initial).toBe(false);
    expect(list.exit.transition.duration).toBe(0.1);
    expect(list.variants.visible.transition?.staggerChildren).toBe(0);
    itemVariants().forEach((variants) => {
      expect(variants.hidden.y).toBe(12);
      expect(variants.visible.transition?.duration).toBe(0.12);
    });
    connectionVariants().forEach((variants) => expect(variants.visible.transition?.duration).toBe(0));
  });

  it("remounts the animated list when the motion policy changes, but not on a plain rerender", () => {
    const media = stubLandingMedia("desktop");
    const view = render(<LandingMotion><StorySteps audience={TALENT_AUDIENCE} /></LandingMotion>);
    const first = panel().querySelector("ol");

    view.rerender(<LandingMotion><StorySteps audience={TALENT_AUDIENCE} /></LandingMotion>);
    expect(panel().querySelector("ol")).toBe(first);

    media.change("reduced");
    const second = panel().querySelector("ol");
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
  });
});
