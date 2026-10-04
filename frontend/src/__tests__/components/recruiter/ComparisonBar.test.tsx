import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComparisonBar } from "@/components/recruiter/ComparisonBar";
import { makeTalentListItem } from "./recruiterFixtures";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const COMPARE_BUTTON = "Comparar talentos";
const FIRST = makeTalentListItem({ id: "t-1", slug: "ana-lima" });
const SECOND = makeTalentListItem({ id: "t-2", slug: "bruno & souza" });

afterEach(() => {
  pushMock.mockClear();
});

describe("ComparisonBar", () => {
  it("renders nothing without selection or message", () => {
    const { container } = render(<ComparisonBar selected={[]} message={null} />);

    expect(container.firstChild).toBeNull();
  });

  it("shows only the message when nothing is selected", () => {
    render(<ComparisonBar selected={[]} message="Limite atingido" />);

    expect(screen.getByText("Limite atingido")).toBeTruthy();
    expect(screen.queryByRole("button", { name: COMPARE_BUTTON })).toBeNull();
  });

  it("asks for one more talent and disables comparing with a single selection", () => {
    render(<ComparisonBar selected={[FIRST]} message={null} />);

    expect(screen.getByText("1 talento selecionado. Selecione mais 1 para comparar.")).toBeTruthy();
    expect(screen.getByText("1 de 2 talentos selecionados.")).toBeTruthy();
    expect((screen.getByRole("button", { name: COMPARE_BUTTON }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("navigates to the comparison page with encoded slugs when two talents are selected", async () => {
    const user = userEvent.setup();
    render(<ComparisonBar selected={[FIRST, SECOND]} message="Aviso" />);

    expect(screen.getByText("2 talentos selecionados para comparação.")).toBeTruthy();
    expect(screen.getByText("Aviso")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: COMPARE_BUTTON }));

    expect(pushMock).toHaveBeenCalledWith("/recrutador/comparar?slugs=ana-lima&slugs=bruno%20%26%20souza");
  });
});
