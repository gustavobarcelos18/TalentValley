import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import { FormDialog } from "@/components/profile/FormDialog";

const TITLE = "Editar dados";
const CHILD_TEXT = "Conteúdo do formulário";
const ERROR_TEXT = "Falha ao salvar";

interface RenderOptions {
  saving?: boolean;
  error?: string | null;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl";
}

function renderDialog({ saving = false, error = null, maxWidth }: RenderOptions = {}) {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  render(
    <FormDialog
      title={TITLE}
      onClose={onClose}
      onSubmit={onSubmit}
      saving={saving}
      error={error}
      maxWidth={maxWidth}
    >
      <p>{CHILD_TEXT}</p>
    </FormDialog>
  );
  return { onClose, onSubmit };
}

describe("FormDialog", () => {
  it("renders an accessible dialog labelled by its title with the children inside", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog", { name: TITLE });
    expect(dialog.textContent).toContain(CHILD_TEXT);
    expect(screen.getByRole("heading", { name: TITLE })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the error alert only when an error is given", () => {
    renderDialog({ error: ERROR_TEXT });

    expect(screen.getByRole("alert").textContent).toBe(ERROR_TEXT);
  });

  it("applies the requested maxWidth and defaults to sm", () => {
    const { unmount } = render(
      <FormDialog title={TITLE} onClose={vi.fn()} onSubmit={vi.fn()} saving={false} error={null}>
        <p>{CHILD_TEXT}</p>
      </FormDialog>
    );
    expect(document.querySelector(".MuiDialog-paperWidthSm")).not.toBeNull();
    unmount();

    renderDialog({ maxWidth: "lg" });
    expect(document.querySelector(".MuiDialog-paperWidthLg")).not.toBeNull();
  });

  it("calls onSubmit once and prevents the native form submission", async () => {
    const { onSubmit } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitEvent = onSubmit.mock.calls[0][0] as FormEvent;
    expect(submitEvent.defaultPrevented).toBe(true);
  });

  it("ignores a submit event while a save is pending", () => {
    const { onSubmit } = renderDialog({ saving: true });

    const form = screen.getByRole("dialog").querySelector("form") as HTMLFormElement;
    fireEvent.submit(form);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onClose from the cancel button", async () => {
    const { onClose, onSubmit } = renderDialog();

    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onClose when the user presses Escape while idle", async () => {
    const { onClose } = renderDialog();

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("blocks Escape and disables both buttons while saving", async () => {
    const { onClose } = renderDialog({ saving: true });

    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
    const cancel = screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement;
    const save = screen.getByRole("button", { name: "Salvando..." }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);
    expect(save.disabled).toBe(true);
    expect(save.querySelector(".MuiCircularProgress-root")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Salvar" })).toBeNull();
  });

  it("shows the idle save label without a spinner", () => {
    renderDialog();

    const save = screen.getByRole("button", { name: "Salvar" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    expect(save.querySelector(".MuiCircularProgress-root")).toBeNull();
  });
});
