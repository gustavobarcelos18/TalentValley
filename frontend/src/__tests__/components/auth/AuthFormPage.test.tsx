import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthFormPage, cascadeSx } from "@/components/auth/AuthFormPage";

const shake = vi.hoisted(() => ({ keys: [] as number[] }));

vi.mock("@/components/auth/motion/useShake", () => ({
  useShake: (key: number) => {
    shake.keys.push(key);
    return createRef<HTMLDivElement>();
  },
}));

const DEFAULT_EYEBROW = "ACESSO À PLATAFORMA";
const SUBTITLE = "Escolha uma senha";
const REDUCED_MOTION = "@media (prefers-reduced-motion: reduce)";

describe("AuthFormPage", () => {
  beforeEach(() => {
    shake.keys.length = 0;
  });

  it("renders the title as the page heading with the default eyebrow", () => {
    render(<AuthFormPage title="Entrar" />);

    expect(screen.getByRole("heading", { level: 1, name: "Entrar" })).not.toBeNull();
    expect(screen.getByText(DEFAULT_EYEBROW)).not.toBeNull();
  });

  it("uses the given eyebrow and subtitle, and omits the subtitle otherwise", () => {
    const { rerender } = render(<AuthFormPage title="Entrar" eyebrow="NOVA SENHA" subtitle={SUBTITLE} />);
    expect(screen.getByText("NOVA SENHA")).not.toBeNull();
    expect(screen.queryByText(DEFAULT_EYEBROW)).toBeNull();
    expect(screen.getByText(SUBTITLE)).not.toBeNull();

    rerender(<AuthFormPage title="Entrar" />);
    expect(screen.queryByText(SUBTITLE)).toBeNull();
  });

  it("renders a plain container, not a form, when there is no submit handler", () => {
    render(
      <AuthFormPage title="Resultado">
        <p>corpo</p>
      </AuthFormPage>,
    );

    expect(document.querySelector("form")).toBeNull();
    expect(screen.getByText("corpo")).not.toBeNull();
  });

  it("renders a novalidate form that calls onSubmit and reflects the busy state", () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <AuthFormPage title="Entrar" onSubmit={onSubmit} ariaBusy>
        <button type="submit">Enviar</button>
      </AuthFormPage>,
    );

    const form = document.querySelector("form") as HTMLFormElement;
    expect(form.noValidate).toBe(true);
    expect(form.getAttribute("aria-busy")).toBe("true");
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not mark the form busy by default", () => {
    render(<AuthFormPage title="Entrar" onSubmit={vi.fn()} />);

    expect((document.querySelector("form") as HTMLFormElement).getAttribute("aria-busy")).toBeNull();
  });

  it("renders the footer links in a footer, and no footer without them", () => {
    const { rerender } = render(<AuthFormPage title="Entrar" footer={<a href="/cadastro">Criar conta</a>} />);
    expect(screen.getByRole("contentinfo").contains(screen.getByRole("link", { name: "Criar conta" }))).toBe(true);

    rerender(<AuthFormPage title="Entrar" />);
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("drives the shake from shakeKey, starting at rest", () => {
    const { rerender } = render(<AuthFormPage title="Entrar" />);
    rerender(<AuthFormPage title="Entrar" shakeKey={3} />);

    expect(shake.keys[0]).toBe(0);
    expect(shake.keys.at(-1)).toBe(3);
  });

  it.each([
    { compact: true, childGap: "16px", formOffset: "20px", eyebrowGap: "8px" },
    { compact: false, childGap: "20px", formOffset: "24px", eyebrowGap: "12px" },
  ])(
    "spaces the content for compact: $compact (children $childGap, form $formOffset, eyebrow $eyebrowGap)",
    ({ compact, childGap, formOffset, eyebrowGap }) => {
      render(
        <AuthFormPage title="Entrar" compact={compact} onSubmit={vi.fn()}>
          <input aria-label="email" />
          <input aria-label="senha" />
        </AuthFormPage>,
      );

      const form = document.querySelector("form") as HTMLFormElement;
      expect(getComputedStyle(screen.getByRole("textbox", { name: "senha" })).marginTop).toBe(childGap);
      expect(getComputedStyle(form).marginTop).toBe(formOffset);
      expect(getComputedStyle(screen.getByText(DEFAULT_EYEBROW)).marginBottom).toBe(eyebrowGap);
    },
  );
});

describe("cascadeSx", () => {
  it("staggers the first eight children from the given step and skips data-no-enter", () => {
    const sx = cascadeSx(3);

    expect(Object.keys(sx)).toContain("& > *:not([data-no-enter])");
    expect(sx["& > *:nth-child(1)"]).toEqual({ animationDelay: "180ms" });
    expect(sx["& > *:nth-child(8)"]).toEqual({ animationDelay: "600ms" });
    expect(sx["& > *:nth-child(9)"]).toBeUndefined();
  });

  it("starts every child at the same time with reduced motion", () => {
    expect(cascadeSx(0)[REDUCED_MOTION]).toEqual({
      "& > *:nth-child(n)": { animationDelay: "0ms" },
    });
  });
});
