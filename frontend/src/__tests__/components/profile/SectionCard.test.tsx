import { screen } from "@testing-library/react";
import { renderThemed as render } from "../recruiter/renderThemed";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { SectionCard } from "@/components/profile/SectionCard";

const TITLE = "Sobre";
const EDIT_LABEL = "Editar sobre";
const EMPTY_MESSAGE = "Nada por aqui ainda.";
const EMPTY_ACTION = "Adicionar agora";
const CONTENT = "Conteúdo da seção";

interface RenderOptions {
  isEmpty?: boolean;
  emptyMessage?: string;
  emptyActionLabel?: string;
  emptyIcon?: ReactNode;
}

function renderCard(options: RenderOptions = {}) {
  const onEdit = vi.fn();
  render(
    <SectionCard title={TITLE} editLabel={EDIT_LABEL} onEdit={onEdit} {...options}>
      <p>{CONTENT}</p>
    </SectionCard>
  );
  return { onEdit };
}

function contentWrapper(): HTMLElement {
  return screen.getByText(CONTENT, { selector: "p" }).parentElement as HTMLElement;
}

describe("SectionCard", () => {
  it("renders the title heading, the children and an accessible edit button", () => {
    renderCard();

    expect(screen.getByRole("heading", { level: 2, name: TITLE })).toBeTruthy();
    expect(screen.getByRole("button", { name: EDIT_LABEL })).toBeTruthy();
    expect(screen.getByText(CONTENT)).toBeTruthy();
  });

  it("does not render the empty state by default", () => {
    renderCard({ emptyMessage: EMPTY_MESSAGE, emptyActionLabel: EMPTY_ACTION });

    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
    expect(screen.queryByRole("button", { name: EMPTY_ACTION })).toBeNull();
    expect(getComputedStyle(contentWrapper()).display).not.toBe("none");
  });

  it("shows the help line under the title only when one is given", () => {
    const { unmount } = render(
      <SectionCard title={TITLE} help="Para que serve." editLabel={EDIT_LABEL} onEdit={vi.fn()}>
        <p>{CONTENT}</p>
      </SectionCard>
    );
    expect(screen.getByText("Para que serve.")).toBeTruthy();
    unmount();

    renderCard();
    expect(screen.queryByText("Para que serve.")).toBeNull();
  });

  it("shows the empty description under the empty title", () => {
    render(
      <SectionCard title={TITLE} editLabel={EDIT_LABEL} onEdit={vi.fn()} isEmpty emptyMessage={EMPTY_MESSAGE} emptyDescription="Conte mais aqui.">
        <p>{CONTENT}</p>
      </SectionCard>
    );

    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
    expect(screen.getByText("Conte mais aqui.")).toBeTruthy();
  });

  it("calls onEdit from the edit icon button", async () => {
    const { onEdit } = renderCard();

    await userEvent.click(screen.getByRole("button", { name: EDIT_LABEL }));

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("shows the empty message and action and hides the children when empty", async () => {
    const { onEdit } = renderCard({
      isEmpty: true,
      emptyMessage: EMPTY_MESSAGE,
      emptyActionLabel: EMPTY_ACTION,
    });

    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
    expect(getComputedStyle(contentWrapper()).display).toBe("none");

    await userEvent.click(screen.getByRole("button", { name: EMPTY_ACTION }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("renders only the empty message when no action label is given", () => {
    renderCard({ isEmpty: true, emptyMessage: EMPTY_MESSAGE });

    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole("button", { name: EMPTY_ACTION })).toBeNull();
  });

  it("renders only the empty action when no message is given", () => {
    renderCard({ isEmpty: true, emptyActionLabel: EMPTY_ACTION });

    expect(screen.queryByText(EMPTY_MESSAGE)).toBeNull();
    expect(screen.getByRole("button", { name: EMPTY_ACTION })).toBeTruthy();
  });

  it("shows the empty icon decoratively above the empty message", () => {
    renderCard({ isEmpty: true, emptyMessage: EMPTY_MESSAGE, emptyIcon: <svg data-testid="empty-icon" /> });

    const icon = screen.getByTestId("empty-icon");
    expect(icon.closest("[aria-hidden='true']")).toBeTruthy();
    expect(screen.getByText(EMPTY_MESSAGE)).toBeTruthy();
  });

  it("renders neither message nor action when empty without empty props", () => {
    renderCard({ isEmpty: true });

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
