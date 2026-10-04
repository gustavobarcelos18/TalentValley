import type { ComponentProps } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonalDataStep } from "@/components/registration/PersonalDataStep";
import { municipioCache } from "@/components/registration/location";
import { commonBlank, type CommonForm } from "@/components/registration/registrationForm";
import { EMOJI, createStepHandlers, field, useExecCommandSpy } from "./stepTestHelpers";

vi.setConfig({ testTimeout: 15_000 });

const NAME = "Nome completo";
const EMAIL = "E-mail";
const PHONE = "Telefone";
const CEP = "CEP";
const CITY = "Cidade";
const STATE = "Estado";
const MANUAL_CITY_MESSAGE = "Não foi possível carregar a lista oficial. Digite a cidade manualmente ou tente novamente.";
const RETRY = "Tentar novamente";
const CITY_ERROR = "Cidade inválida.";

const MUNICIPIOS = [
  { id: 3170404, nome: "Ubá" },
  { id: 3136702, nome: "Juiz de Fora" },
  { id: 3153004, nome: "Rio Pomba" },
];

const handlers = createStepHandlers();

type StepProps = Partial<Omit<ComponentProps<typeof PersonalDataStep>, "value">> & { value?: Partial<CommonForm> };

function stepElement({ value, ...props }: StepProps = {}) {
  return (
    <PersonalDataStep
      value={{ ...commonBlank, ...value }}
      errors={{}}
      onChange={handlers.onChange}
      onBlur={handlers.onBlur}
      registerFieldRef={handlers.registerFieldRef}
      disabled={false}
      cepStatus={{ type: "idle" }}
      {...props}
    />
  );
}

function renderStep(props: StepProps = {}) {
  return render(stepElement(props));
}

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

function cityInput() {
  return screen.getByRole("combobox", { name: new RegExp(`^${CITY}`) }) as HTMLInputElement;
}

function stateSelect() {
  return screen.getByRole("combobox", { name: new RegExp(STATE) });
}

describe("PersonalDataStep", () => {
  const fetchMock = vi.fn();
  const execCommand = useExecCommandSpy();

  beforeEach(() => {
    handlers.reset();
    municipioCache.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(jsonResponse(MUNICIPIOS));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("identification and contact", () => {
    it("shows the current values and configures the fields for browsers", () => {
      renderStep({ value: { nomeCompleto: "Ana", email: "ana@exemplo.com", telefone: "(32) 9" } });

      expect(field(NAME).value).toBe("Ana");
      expect(field(NAME).getAttribute("autocomplete")).toBe("name");
      expect(field(NAME).maxLength).toBe(150);
      expect(field(EMAIL).value).toBe("ana@exemplo.com");
      expect(field(EMAIL).type).toBe("email");
      expect(field(EMAIL).maxLength).toBe(254);
      expect(field(PHONE).type).toBe("tel");
      expect(field(PHONE).getAttribute("inputmode")).toBe("tel");
      expect(field(PHONE).value).toBe("(32) 9");
    });

    it("sanitizes the name, and strips emoji and caps the length of the e-mail", () => {
      renderStep();

      fireEvent.change(field(NAME), { target: { value: `Ana${EMOJI}  123` } });
      expect(handlers.onChange).toHaveBeenLastCalledWith("nomeCompleto", expect.not.stringContaining(EMOJI));
      expect(handlers.onChange.mock.lastCall?.[1]).not.toMatch(/\d/);

      fireEvent.change(field(EMAIL), { target: { value: `a${EMOJI}@b.com` } });
      expect(handlers.onChange).toHaveBeenLastCalledWith("email", "a@b.com");

      fireEvent.change(field(EMAIL), { target: { value: "x".repeat(300) } });
      expect(handlers.onChange).toHaveBeenLastCalledWith("email", "x".repeat(254));
    });

    it("strips emoji from the phone without capping it", () => {
      renderStep();

      fireEvent.change(field(PHONE), { target: { value: `(32) 99999-9999${EMOJI}` } });

      expect(handlers.onChange).toHaveBeenLastCalledWith("telefone", "(32) 99999-9999");
    });

    it.each([
      { label: NAME, key: "nomeCompleto" },
      { label: EMAIL, key: "email" },
      { label: PHONE, key: "telefone" },
      { label: CEP, key: "cep" },
    ])("reports the blur of $key", ({ label, key }) => {
      renderStep();

      fireEvent.blur(field(label));

      expect(handlers.onBlur).toHaveBeenCalledExactlyOnceWith(key);
    });

    it("removes emoji from pasted text", () => {
      renderStep();

      const accepted = fireEvent.paste(field(NAME), { clipboardData: { getData: () => `Ana${EMOJI}` } });

      expect(accepted).toBe(false);
      expect(execCommand).toHaveBeenCalledWith("insertText", false, "Ana");
    });

    it("registers the controls under their field keys", () => {
      renderStep();

      expect(handlers.refs.get("nomeCompleto")).toHaveBeenCalledWith(field(NAME));
      expect(handlers.refs.get("email")).toHaveBeenCalledWith(field(EMAIL));
      expect(handlers.refs.get("telefone")).toHaveBeenCalledWith(field(PHONE));
      expect(handlers.refs.get("cep")).toHaveBeenCalledWith(field(CEP));
      expect(handlers.refs.get("cidade")).toHaveBeenCalledWith(cityInput());
      expect(handlers.refs.get("uf")).toHaveBeenCalledWith(expect.objectContaining({ focus: expect.any(Function) }));
    });

    it("shows errors in place of the hints and flags the fields invalid", () => {
      renderStep({
        errors: {
          nomeCompleto: "Nome inválido.",
          email: "E-mail inválido.",
          telefone: "Telefone inválido.",
          cep: "CEP inválido.",
          uf: "Estado inválido.",
          cidade: CITY_ERROR,
        },
      });

      for (const message of ["Nome inválido.", "E-mail inválido.", "Telefone inválido.", "CEP inválido.", "Estado inválido.", CITY_ERROR]) {
        expect(screen.getByText(message)).toBeTruthy();
      }
      expect(screen.queryByText("Ex.: (32) 99999-9999")).toBeNull();
      expect(screen.queryByText("Opcional; 8 dígitos para preencher Cidade e UF.")).toBeNull();
      for (const label of [NAME, EMAIL, PHONE, CEP]) expect(field(label).getAttribute("aria-invalid")).toBe("true");
      expect(cityInput().getAttribute("aria-invalid")).toBe("true");
    });

    it("explains the phone format and the optional CEP while they have no error", () => {
      renderStep();

      expect(screen.getByText("Ex.: (32) 99999-9999")).toBeTruthy();
      expect(screen.getByText("Opcional; 8 dígitos para preencher Cidade e UF.")).toBeTruthy();
      expect(field(CEP).required).toBe(false);
      expect(field(NAME).required).toBe(true);
    });

    it("disables every field", () => {
      renderStep({ disabled: true, value: { uf: "MG" } });

      for (const label of [NAME, EMAIL, PHONE, CEP]) expect(field(label).disabled).toBe(true);
      expect(stateSelect().getAttribute("aria-disabled")).toBe("true");
      expect(cityInput().disabled).toBe(true);
    });
  });

  describe("CEP", () => {
    let setSelectionRange: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
        callback(0);
        return 0;
      });
      setSelectionRange = vi.spyOn(HTMLInputElement.prototype, "setSelectionRange");
    });

    it("formats what is typed and restores the caret after the digits before it", () => {
      renderStep();
      const input = field(CEP);

      fireEvent.change(input, { target: { value: "367001" } });

      expect(handlers.onChange).toHaveBeenLastCalledWith("cep", "36700-1");
      expect(setSelectionRange).toHaveBeenLastCalledWith(7, 7);
    });

    it("rebuilds a pasted CEP from its digits, taking over the native paste", () => {
      renderStep();

      const accepted = fireEvent.paste(field(CEP), { clipboardData: { getData: () => "36.700-120" } });

      expect(accepted).toBe(false);
      expect(handlers.onChange).toHaveBeenLastCalledWith("cep", "36700-120");
      expect(setSelectionRange).toHaveBeenLastCalledWith(9, 9);
    });

    it("pastes over the selection, keeping the digits around it", () => {
      renderStep({ value: { cep: "36700-120" } });
      const input = field(CEP);
      input.setSelectionRange(0, 5);

      fireEvent.paste(input, { clipboardData: { getData: () => "11111" } });

      expect(handlers.onChange).toHaveBeenLastCalledWith("cep", "11111-120");
    });

    it("keeps the native paste when the clipboard has no digits", () => {
      renderStep();

      const accepted = fireEvent.paste(field(CEP), { clipboardData: { getData: () => "abc" } });

      expect(accepted).toBe(true);
      expect(handlers.onChange).not.toHaveBeenCalled();
    });

    it("deletes the digit before the hyphen when backspace is pressed right after it", () => {
      renderStep({ value: { cep: "36700-1" } });
      const input = field(CEP);
      input.setSelectionRange(6, 6);

      const accepted = fireEvent.keyDown(input, { key: "Backspace" });

      expect(accepted).toBe(false);
      expect(handlers.onChange).toHaveBeenLastCalledWith("cep", "36701");
      expect(setSelectionRange).toHaveBeenLastCalledWith(4, 4);
    });

    it.each([
      { name: "another key", key: "a", cep: "36700-1", caret: 6 },
      { name: "backspace at the start", key: "Backspace", cep: "36700-1", caret: 0 },
      { name: "backspace after a digit", key: "Backspace", cep: "36700-1", caret: 7 },
    ])("leaves the key alone for $name", ({ key, cep, caret }) => {
      renderStep({ value: { cep } });
      const input = field(CEP);
      input.setSelectionRange(caret, caret);

      const accepted = fireEvent.keyDown(input, { key });

      expect(accepted).toBe(true);
      expect(handlers.onChange).not.toHaveBeenCalled();
    });

    it("shows a spinner while the lookup is loading", () => {
      renderStep({ cepStatus: { type: "loading" } });

      expect(screen.getByRole("progressbar")).toBeTruthy();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("has no spinner or status while idle", () => {
      renderStep();

      expect(screen.queryByRole("progressbar")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("announces the default autofill message on success", () => {
      renderStep({ cepStatus: { type: "success" } });

      expect(screen.getByRole("status").textContent).toBe("Cidade e UF preenchidas pelo CEP.");
    });

    it("announces the custom message of a partial success", () => {
      renderStep({ cepStatus: { type: "success", message: "UF preenchida pelo CEP. Selecione a cidade na lista." } });

      expect(screen.getByRole("status").textContent).toBe("UF preenchida pelo CEP. Selecione a cidade na lista.");
    });

    it("announces the lookup error", () => {
      renderStep({ cepStatus: { type: "error", message: "Não foi possível localizar o CEP." } });

      expect(screen.getByRole("status").textContent).toBe("Não foi possível localizar o CEP.");
    });
  });

  describe("state", () => {
    it("lists a placeholder and the 27 states, and reports the chosen one clearing the city", async () => {
      const user = userEvent.setup({ delay: null });
      renderStep({ value: { uf: "SP", cidade: "Santos" } });

      await user.click(stateSelect());
      const options = within(screen.getByRole("listbox")).getAllByRole("option");
      expect(options[0].textContent).toBe("Selecione");
      expect(options).toHaveLength(28);

      await user.click(screen.getByRole("option", { name: "MG" }));

      expect(handlers.onChange.mock.calls).toEqual([
        ["uf", "MG"],
        ["cidade", ""],
      ]);
    });

    it("reports the state blur", () => {
      renderStep({ value: { uf: "MG" } });

      fireEvent.blur(stateSelect());

      expect(handlers.onBlur).toHaveBeenCalledWith("uf");
    });
  });

  describe("city with the official list", () => {
    it("is disabled until a state is chosen, asking for it", () => {
      renderStep();

      expect(cityInput().disabled).toBe(true);
      expect(cityInput().getAttribute("placeholder")).toBe("Escolha o estado");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("loads the cities of the state from IBGE and invites a search", async () => {
      renderStep({ value: { uf: "MG" } });

      expect(cityInput().getAttribute("placeholder")).toBe("Busque e selecione");
      expect(cityInput().disabled).toBe(false);
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(String(fetchMock.mock.calls[0][0])).toContain("/estados/MG/municipios");
    });

    it("shows the loading text while the list has not arrived", async () => {
      const user = userEvent.setup({ delay: null });
      fetchMock.mockReturnValue(new Promise(() => undefined));
      renderStep({ value: { uf: "MG" } });

      await user.click(cityInput());

      expect(await screen.findByText("Carregando cidades...")).toBeTruthy();
    });

    it("shows the selected city by its official name", async () => {
      renderStep({ value: { uf: "MG", cidade: "Ubá" } });

      await waitFor(() => expect(cityInput().value).toBe("Ubá"));
    });

    it("filters the options ignoring accents and reports the chosen city", async () => {
      const user = userEvent.setup({ delay: null });
      renderStep({ value: { uf: "MG" } });
      await waitFor(() => expect(municipioCache.get("MG")).toBeDefined());

      await user.type(cityInput(), "uba");
      const options = within(await screen.findByRole("listbox")).getAllByRole("option");
      expect(options.map((option) => option.textContent)).toEqual(["Ubá"]);

      await user.click(options[0]);

      expect(handlers.onChange).toHaveBeenLastCalledWith("cidade", "Ubá");
    });

    it("tells when no city matches the search", async () => {
      const user = userEvent.setup({ delay: null });
      renderStep({ value: { uf: "MG" } });
      await waitFor(() => expect(municipioCache.get("MG")).toBeDefined());

      await user.type(cityInput(), "zzz");

      expect(await screen.findByText("Nenhuma cidade encontrada.")).toBeTruthy();
    });

    it("marks the current city as selected when the list opens", async () => {
      const user = userEvent.setup({ delay: null });
      renderStep({ value: { uf: "MG", cidade: "Ubá" } });
      await waitFor(() => expect(cityInput().value).toBe("Ubá"));

      await user.click(screen.getByRole("button", { name: "Open" }));

      const options = within(await screen.findByRole("listbox")).getAllByRole("option");
      expect(options).toHaveLength(MUNICIPIOS.length);
      expect(options.filter((option) => option.getAttribute("aria-selected") === "true").map((option) => option.textContent)).toEqual(["Ubá"]);
    });

    it("clears the city when the selection is cleared", async () => {
      const user = userEvent.setup({ delay: null });
      renderStep({ value: { uf: "MG", cidade: "Ubá" } });
      await waitFor(() => expect(cityInput().value).toBe("Ubá"));

      await user.clear(cityInput());

      expect(handlers.onChange).toHaveBeenLastCalledWith("cidade", "");
    });

    it("reports the city blur and strips emoji from pasted text", async () => {
      renderStep({ value: { uf: "MG" } });

      fireEvent.blur(cityInput());
      const accepted = fireEvent.paste(cityInput(), { clipboardData: { getData: () => `Ubá${EMOJI}` } });

      expect(handlers.onBlur).toHaveBeenCalledWith("cidade");
      expect(accepted).toBe(false);
      expect(execCommand).toHaveBeenCalledWith("insertText", false, "Ubá");
      await waitFor(() => expect(municipioCache.get("MG")).toBeDefined());
    });

    it("does not show the manual fallback while the list loads", () => {
      renderStep({ value: { uf: "MG" } });

      expect(screen.queryByText(MANUAL_CITY_MESSAGE)).toBeNull();
      expect(screen.queryByRole("button", { name: RETRY })).toBeNull();
    });
  });

  describe("city when the official list fails", () => {
    beforeEach(() => {
      fetchMock.mockRejectedValue(new Error("offline"));
    });

    it("swaps to a text field that sanitizes what is typed", async () => {
      renderStep({ value: { uf: "MG", cidade: "Ub" } });

      expect(await screen.findByText(MANUAL_CITY_MESSAGE)).toBeTruthy();
      const input = field(CITY);
      expect(input.value).toBe("Ub");
      expect(input.getAttribute("autocomplete")).toBe("address-level2");
      expect(input.maxLength).toBe(120);

      fireEvent.change(input, { target: { value: `Ubá${EMOJI}` } });
      expect(handlers.onChange).toHaveBeenLastCalledWith("cidade", "Ubá");

      fireEvent.blur(input);
      expect(handlers.onBlur).toHaveBeenCalledWith("cidade");
      expect(handlers.refs.get("cidade")).toHaveBeenCalledWith(input);
    });

    it("shows the city error and strips emoji from pasted text", async () => {
      renderStep({ value: { uf: "MG" }, errors: { cidade: CITY_ERROR } });

      await screen.findByText(MANUAL_CITY_MESSAGE);
      expect(screen.getByText(CITY_ERROR)).toBeTruthy();
      expect(field(CITY).getAttribute("aria-invalid")).toBe("true");

      const accepted = fireEvent.paste(field(CITY), { clipboardData: { getData: () => `Ubá${EMOJI}` } });
      expect(accepted).toBe(false);
      expect(execCommand).toHaveBeenCalledWith("insertText", false, "Ubá");
    });

    it("retries the lookup and goes back to the list when it recovers", async () => {
      const user = userEvent.setup({ delay: null });
      renderStep({ value: { uf: "MG" } });
      await screen.findByText(MANUAL_CITY_MESSAGE);
      fetchMock.mockResolvedValue(jsonResponse(MUNICIPIOS));

      await user.click(screen.getByRole("button", { name: RETRY }));

      await waitFor(() => expect(screen.queryByText(MANUAL_CITY_MESSAGE)).toBeNull());
      expect(cityInput().getAttribute("placeholder")).toBe("Busque e selecione");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("normalizes a typed city to the official name once the list recovers", async () => {
      const user = userEvent.setup({ delay: null });
      renderStep({ value: { uf: "MG", cidade: "uba" } });
      await screen.findByText(MANUAL_CITY_MESSAGE);
      fetchMock.mockResolvedValue(jsonResponse(MUNICIPIOS));

      await user.click(screen.getByRole("button", { name: RETRY }));

      await waitFor(() => expect(handlers.onChange).toHaveBeenCalledWith("cidade", "Ubá"));
    });

    it("clears a typed city that is not in the official list once it recovers", async () => {
      const user = userEvent.setup({ delay: null });
      renderStep({ value: { uf: "MG", cidade: "Atlantida" } });
      await screen.findByText(MANUAL_CITY_MESSAGE);
      fetchMock.mockResolvedValue(jsonResponse(MUNICIPIOS));

      await user.click(screen.getByRole("button", { name: RETRY }));

      await waitFor(() => expect(handlers.onChange).toHaveBeenCalledWith("cidade", ""));
    });

    it("leaves an empty city alone once the list recovers", async () => {
      const user = userEvent.setup({ delay: null });
      renderStep({ value: { uf: "MG" } });
      await screen.findByText(MANUAL_CITY_MESSAGE);
      fetchMock.mockResolvedValue(jsonResponse(MUNICIPIOS));

      await user.click(screen.getByRole("button", { name: RETRY }));

      await waitFor(() => expect(screen.queryByText(MANUAL_CITY_MESSAGE)).toBeNull());
      expect(handlers.onChange).not.toHaveBeenCalled();
    });
  });

  it("does not reconcile a city when the list was never in error", async () => {
    renderStep({ value: { uf: "MG", cidade: "uba" } });

    await waitFor(() => expect(municipioCache.get("MG")).toBeDefined());

    expect(handlers.onChange).not.toHaveBeenCalled();
  });

  it("starts from the cached list without calling IBGE again", () => {
    municipioCache.set("MG", MUNICIPIOS);
    renderStep({ value: { uf: "MG", cidade: "Ubá" } });

    expect(cityInput().value).toBe("Ubá");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
