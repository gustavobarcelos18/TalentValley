import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import GlobalError from "@/app/global-error";

// GlobalError renders its own <html>, so it is mounted straight into the document.
function renderGlobalError(retry = vi.fn()) {
  render(<GlobalError error={new Error("boom")} retry={retry} />, { container: document });
  return retry;
}

describe("global error page", () => {
  it("replaces the layout with an accessible alert in Portuguese", () => {
    renderGlobalError();

    expect(document.documentElement.lang).toBe("pt-BR");
    expect(screen.getByRole("alert").textContent).toContain("Não foi possível carregar a plataforma. Tente novamente em instantes.");
    expect(screen.getByRole("heading", { name: "Algo deu errado" })).toBeTruthy();
  });

  it("retries when the user asks to try again", async () => {
    const retry = renderGlobalError();

    await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
