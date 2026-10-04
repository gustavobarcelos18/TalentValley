import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

const SUBTITLE = "Acesse sua conta";

describe("AuthPageShell", () => {
  it("renders a heading, subtitle and children inside a card", () => {
    render(
      <AuthPageShell title="Entrar" subtitle={SUBTITLE}>
        <p>conteúdo</p>
      </AuthPageShell>,
    );

    expect(screen.getByRole("main")).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "Entrar" })).not.toBeNull();
    expect(screen.getByText(SUBTITLE)).not.toBeNull();
    expect(screen.getByText("conteúdo")).not.toBeNull();
  });

  it("omits the heading block without a title, and the subtitle without one", () => {
    const { rerender } = render(<AuthPageShell>corpo</AuthPageShell>);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText("corpo")).not.toBeNull();

    rerender(<AuthPageShell title="Só título">corpo</AuthPageShell>);
    expect(screen.getByRole("heading", { name: "Só título" })).not.toBeNull();
    expect(screen.queryByText(SUBTITLE)).toBeNull();
  });

  it("renders a non-form card when there is no submit handler", () => {
    render(<AuthPageShell title="Resultado">corpo</AuthPageShell>);

    expect(document.querySelector("form")).toBeNull();
  });

  it("turns the card into a busy, novalidate form that calls onSubmit", () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <AuthPageShell title="Entrar" onSubmit={onSubmit} ariaBusy>
        <button type="submit">Enviar</button>
      </AuthPageShell>,
    );

    const form = document.querySelector("form") as HTMLFormElement;
    expect(form.noValidate).toBe(true);
    expect(form.getAttribute("aria-busy")).toBe("true");

    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("does not mark the form busy unless asked", () => {
    render(<AuthPageShell onSubmit={vi.fn()}>corpo</AuthPageShell>);

    expect((document.querySelector("form") as HTMLFormElement).getAttribute("aria-busy")).toBeNull();
  });

  it("renders only the page background in bare mode", () => {
    render(
      <AuthPageShell title="Entrar" bare>
        <p>conteúdo</p>
      </AuthPageShell>,
    );

    const main = screen.getByRole("main");
    expect(main.childElementCount).toBe(0);
    expect(screen.queryByText("conteúdo")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
  });
});
