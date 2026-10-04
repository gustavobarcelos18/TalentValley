import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FavoriteButton } from "@/components/recruiter/FavoriteButton";
import { ApiError } from "@/lib/api";
import { addFavorite, removeFavorite } from "@/lib/recruiter";

vi.mock("@/lib/recruiter", () => ({ addFavorite: vi.fn(), removeFavorite: vi.fn() }));

const addMock = vi.mocked(addFavorite);
const removeMock = vi.mocked(removeFavorite);

const SLUG = "maria-souza";
const NAME = "Maria Souza";
const ADD_LABEL = `Adicionar aos favoritos: ${NAME}`;
const REMOVE_LABEL = `Remover dos favoritos: ${NAME}`;
const UNAVAILABLE = "Este perfil não está mais disponível.";
const GENERIC_FAILURE = "Não foi possível atualizar os favoritos.";
const NOT_FOUND = 404;
const SERVER_ERROR = 500;

function isDisabled(name: string): boolean {
  return (screen.getByRole("button", { name }) as HTMLButtonElement).disabled;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("FavoriteButton", () => {
  it("adds a favorite and reports the new state", async () => {
    addMock.mockResolvedValue(undefined);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FavoriteButton slug={SLUG} name={NAME} favorite={false} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: ADD_LABEL }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    expect(addMock).toHaveBeenCalledWith(SLUG);
    expect(removeMock).not.toHaveBeenCalled();
  });

  it("removes a favorite and reports the new state", async () => {
    removeMock.mockResolvedValue(undefined);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FavoriteButton slug={SLUG} name={NAME} favorite onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: REMOVE_LABEL }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
    expect(removeMock).toHaveBeenCalledWith(SLUG);
    expect(addMock).not.toHaveBeenCalled();
  });

  it("disables the button and shows progress while the request is pending", async () => {
    let finish: () => void = () => undefined;
    addMock.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    render(<FavoriteButton slug={SLUG} name={NAME} favorite={false} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: ADD_LABEL }));

    expect(isDisabled(ADD_LABEL)).toBe(true);
    expect(screen.getByRole("button", { name: ADD_LABEL }).getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Atualizando…")).toBeTruthy();

    finish();
    await waitFor(() => expect(isDisabled(ADD_LABEL)).toBe(false));
  });

  it("calls onUnavailable when the profile no longer exists", async () => {
    addMock.mockRejectedValue(new ApiError(NOT_FOUND, "Not found"));
    const onChange = vi.fn();
    const onUnavailable = vi.fn();
    const user = userEvent.setup();
    render(<FavoriteButton slug={SLUG} name={NAME} favorite={false} onChange={onChange} onUnavailable={onUnavailable} />);

    await user.click(screen.getByRole("button", { name: ADD_LABEL }));

    await waitFor(() => expect(onUnavailable).toHaveBeenCalledTimes(1));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the unavailable message when a 404 happens without onUnavailable", async () => {
    addMock.mockRejectedValue(new ApiError(NOT_FOUND, "Not found"));
    const user = userEvent.setup();
    render(<FavoriteButton slug={SLUG} name={NAME} favorite={false} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: ADD_LABEL }));

    expect((await screen.findByRole("alert")).textContent).toBe(UNAVAILABLE);
  });

  it("shows the API error message for other API failures", async () => {
    removeMock.mockRejectedValue(new ApiError(SERVER_ERROR, "Falha no servidor"));
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<FavoriteButton slug={SLUG} name={NAME} favorite onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: REMOVE_LABEL }));

    expect((await screen.findByRole("alert")).textContent).toBe("Falha no servidor");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("falls back to the generic message for unknown failures", async () => {
    addMock.mockRejectedValue("boom");
    const user = userEvent.setup();
    render(<FavoriteButton slug={SLUG} name={NAME} favorite={false} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: ADD_LABEL }));

    expect((await screen.findByRole("alert")).textContent).toBe(GENERIC_FAILURE);
  });

  it("clears the previous error on the next attempt", async () => {
    addMock.mockRejectedValueOnce("boom").mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<FavoriteButton slug={SLUG} name={NAME} favorite={false} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: ADD_LABEL }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: ADD_LABEL }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("does not propagate the click to parent elements", async () => {
    addMock.mockResolvedValue(undefined);
    const onParentClick = vi.fn();
    const user = userEvent.setup();
    render(
      <div onClick={onParentClick}>
        <FavoriteButton slug={SLUG} name={NAME} favorite={false} onChange={vi.fn()} />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: ADD_LABEL }));

    await waitFor(() => expect(addMock).toHaveBeenCalled());
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
