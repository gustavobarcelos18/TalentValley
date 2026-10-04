import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AuthTemplate from "@/app/(auth)/template";
import { duration, ease } from "@/components/auth/motion/tokens";

type MotionProps = { initial: unknown; animate: unknown; transition: unknown; children: ReactNode };

const mocks = vi.hoisted(() => ({ pathname: "/login", policy: "pointer", calls: [] as MotionProps[] }));

vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/components/auth/motion/useMotionPolicy", () => ({ useMotionPolicy: () => mocks.policy }));
vi.mock("framer-motion", () => ({
  motion: {
    div: (props: MotionProps) => {
      mocks.calls.push(props);
      return <div data-testid="motion">{props.children}</div>;
    },
  },
}));

function lastProps() {
  const props = mocks.calls.at(-1);
  if (!props) throw new Error("The motion wrapper has not rendered yet");
  return props;
}

// The template remounts on every navigation, so the screen being left is still mounted
// (and has recorded its depth) when the next one renders for the first time.
function enter(pathname: string, policy = "pointer") {
  mocks.pathname = pathname;
  mocks.policy = policy;
  return render(
    <AuthTemplate>
      <p>{pathname}</p>
    </AuthTemplate>,
  );
}

describe("auth template", () => {
  afterEach(() => {
    mocks.calls.length = 0;
  });

  it("renders its children inside the animated wrapper", () => {
    enter("/login");
    expect(screen.getByTestId("motion").textContent).toBe("/login");
  });

  it("fades the content in with the shared motion tokens", () => {
    enter("/login");
    expect(lastProps().animate).toEqual({ opacity: 1, x: 0 });
    expect(lastProps().transition).toEqual({ duration: duration.base, ease: ease.outExpo });
  });

  it("skips the entry animation on the first screen", () => {
    enter("/cadastro");
    expect(lastProps().initial).toBe(false);
  });

  it("slides forward when moving to a deeper screen", () => {
    enter("/login");
    enter("/esqueci-senha");
    expect(lastProps().initial).toEqual({ opacity: 0, x: 28 });
  });

  it("slides back when moving to a shallower screen", () => {
    enter("/redefinir-senha");
    enter("/login");
    expect(lastProps().initial).toEqual({ opacity: 0, x: -28 });
  });

  it("slides forward between screens at the same depth", () => {
    enter("/cadastro");
    enter("/reenviar-ativacao");
    expect(lastProps().initial).toEqual({ opacity: 0, x: 28 });
  });

  it("treats nested routes by their first segment", () => {
    enter("/login");
    enter("/cadastro/aluno");
    expect(lastProps().initial).toEqual({ opacity: 0, x: 28 });
  });

  it("treats an unknown route as the first screen of the flow", () => {
    enter("/ativar-conta");
    enter("/desconhecida");
    expect(lastProps().initial).toEqual({ opacity: 0, x: -28 });
  });

  it("shortens the slide on touch devices", () => {
    enter("/login", "touch");
    enter("/cadastro", "touch");
    expect(lastProps().initial).toEqual({ opacity: 0, x: 14 });
  });

  it("only fades, without moving, when motion is reduced", () => {
    enter("/login", "reduced");
    enter("/cadastro", "reduced");
    expect(lastProps().initial).toEqual({ opacity: 0, x: 0 });
  });

  it("forgets the previous screen once the user leaves the auth screens", () => {
    const first = enter("/login");
    first.unmount();
    enter("/cadastro");
    expect(lastProps().initial).toBe(false);
  });
});
