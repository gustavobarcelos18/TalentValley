import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMotionMedia } from "@/__tests__/components/auth/motion/motionMedia";
import { WizardProgress, WizardStepHeading, WizardStepTransition } from "@/components/registration/WizardProgress";

vi.setConfig({ testTimeout: 15_000 });

const STEPS = ["Dados", "Formação", "Revisão"];
const DESCRIPTION = "Conte quem é você";

beforeEach(() => {
  stubMotionMedia("pointer");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function railFill(container: HTMLElement) {
  return container.querySelector("div[aria-hidden] > div:first-child > div") as HTMLElement;
}

function stepContainer(text: string) {
  return screen.getByText(text).parentElement?.parentElement as HTMLElement;
}

describe("WizardProgress", () => {
  it("is decorative and labels every step", () => {
    const { container } = render(<WizardProgress steps={STEPS} activeStep={0} />);

    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    for (const label of STEPS) expect(screen.getByText(label)).toBeTruthy();
  });

  it("numbers the steps that are active or ahead and draws a check on the ones behind", () => {
    const { container } = render(<WizardProgress steps={STEPS} activeStep={1} />);

    expect(screen.queryByText("1")).toBeNull();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(container.querySelectorAll("svg")).toHaveLength(1);
  });

  it("fills the rail in proportion to the active step", () => {
    const { container, rerender } = render(<WizardProgress steps={STEPS} activeStep={0} />);
    expect(getComputedStyle(railFill(container)).transform).toBe("scaleX(0)");

    rerender(<WizardProgress steps={STEPS} activeStep={1} />);
    expect(getComputedStyle(railFill(container)).transform).toBe("scaleX(0.5)");

    rerender(<WizardProgress steps={STEPS} activeStep={2} />);
    expect(getComputedStyle(railFill(container)).transform).toBe("scaleX(1)");
  });

  it("keeps the rail empty when there is a single step", () => {
    const { container } = render(<WizardProgress steps={["Único"]} activeStep={0} />);

    expect(getComputedStyle(railFill(container)).transform).toBe("scaleX(0)");
  });

  it("emphasizes only the active label", () => {
    render(<WizardProgress steps={STEPS} activeStep={1} />);

    expect(getComputedStyle(screen.getByText("Formação")).fontWeight).toBe("600");
    expect(getComputedStyle(screen.getByText("Dados")).fontWeight).toBe("400");
    expect(getComputedStyle(screen.getByText("Revisão")).fontWeight).toBe("400");
  });
});

describe("WizardStepHeading", () => {
  it("announces the step position to screen readers before the title", () => {
    render(<WizardStepHeading step={1} total={3} title="Formação" />);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading.textContent).toBe("Etapa 2 de 3: Formação");
    expect(heading.querySelector(".sr-only")?.textContent).toBe("Etapa 2 de 3: ");
    expect(heading.getAttribute("tabindex")).toBe("-1");
  });

  it("renders the description only when given", () => {
    const { rerender } = render(<WizardStepHeading step={0} total={3} title="Dados" description={DESCRIPTION} />);
    expect(screen.getByText(DESCRIPTION)).toBeTruthy();

    rerender(<WizardStepHeading step={0} total={3} title="Dados" />);
    expect(screen.queryByText(DESCRIPTION)).toBeNull();
  });

  it("keeps focus where it is on the first render", () => {
    render(<WizardStepHeading step={0} total={3} title="Dados" />);

    expect(document.activeElement).toBe(document.body);
  });

  it("takes focus when the step changes, and only then", () => {
    const { rerender } = render(<WizardStepHeading step={0} total={3} title="Dados" />);
    const heading = screen.getByRole("heading", { level: 2 });

    rerender(<WizardStepHeading step={1} total={3} title="Formação" />);
    expect(document.activeElement).toBe(heading);

    heading.blur();
    rerender(<WizardStepHeading step={1} total={3} title="Formação revisada" />);
    expect(document.activeElement).toBe(document.body);
  });
});

describe("WizardStepTransition", () => {
  it("renders the children in a grid inside a group the form cascade skips", () => {
    render(
      <WizardStepTransition step={0} direction={1} moved={false}>
        <input aria-label="campo" />
      </WizardStepTransition>,
    );

    const grid = screen.getByLabelText("campo").parentElement as HTMLElement;
    expect(getComputedStyle(grid).display).toBe("grid");
    expect(grid.closest("[data-no-enter]")).toBeTruthy();
  });

  it.each([
    { policy: "pointer", distance: 28 },
    { policy: "touch", distance: 14 },
    { policy: "reduced", distance: 0 },
  ] as const)("slides the new step in by $distance px under the $policy motion policy", ({ policy, distance }) => {
    vi.unstubAllGlobals();
    stubMotionMedia(policy);
    const { rerender } = render(
      <WizardStepTransition step={0} direction={1} moved={false}>
        <p>primeira</p>
      </WizardStepTransition>,
    );

    act(() => {
      rerender(
        <WizardStepTransition step={1} direction={-1} moved>
          <p>segunda</p>
        </WizardStepTransition>,
      );
    });

    expect(stepContainer("segunda").style.transform).toBe(`translateX(${-distance}px)`);
  });

  it("mounts the new step at once while the previous one leaves", () => {
    const { rerender } = render(
      <WizardStepTransition step={0} direction={1} moved={false}>
        <p>primeira</p>
      </WizardStepTransition>,
    );

    act(() => {
      rerender(
        <WizardStepTransition step={1} direction={1} moved>
          <p>segunda</p>
        </WizardStepTransition>,
      );
    });

    expect(screen.getByText("segunda")).toBeTruthy();
    expect(screen.getByText("primeira")).toBeTruthy();
    expect(stepContainer("primeira").style.transform).toBe("translateX(0px)");
  });
});
