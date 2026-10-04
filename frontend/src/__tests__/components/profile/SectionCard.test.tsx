import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("renders neither message nor action when empty without empty props", () => {
    renderCard({ isEmpty: true });

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
