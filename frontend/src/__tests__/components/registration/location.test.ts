import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyCepPaste,
  caretAfterDigits,
  fetchMunicipios,
  findMunicipio,
  formatCep,
  municipioCache,
  municipioFilter,
  readViaCep,
  validateCep,
  type Municipio,
} from "@/components/registration/location";

const CEP_ERROR = "Informe um CEP válido com 8 dígitos.";
const SAO_PAULO: Municipio = { id: 1, nome: "São Paulo" };
const SIGNAL = new AbortController().signal;

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, json: () => Promise.resolve(body) }) as Response;

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  municipioCache.clear();
});

describe("municipioFilter", () => {
  it("filters ignoring accents and case", () => {
    const options = [SAO_PAULO, { id: 2, nome: "Rio Pomba" }];

    const result = municipioFilter(options, {
      inputValue: "SAO",
      getOptionLabel: (option) => option.nome,
    });

    expect(result).toEqual([SAO_PAULO]);
  });

  it("limits the filtered list to 100 options", () => {
    const options = Array.from({ length: 150 }, (_, index) => ({ id: index, nome: `Cidade ${index}` }));

    const result = municipioFilter(options, { inputValue: "", getOptionLabel: (option) => option.nome });

    expect(result).toHaveLength(100);
  });
});

describe("findMunicipio", () => {
  it("matches regardless of accents, case and extra whitespace", () => {
    expect(findMunicipio([SAO_PAULO], "  sao   PAULO ")).toBe(SAO_PAULO);
  });

  it("returns null when there is no match", () => {
    expect(findMunicipio([SAO_PAULO], "Rio Pomba")).toBeNull();
  });
});

describe("fetchMunicipios", () => {
  it("requests the IBGE list for the UF with the given signal", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, nome: "Rio Pomba" }]));

    await fetchMunicipios("MG", SIGNAL);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://servicodados.ibge.gov.br/api/v1/localidades/estados/MG/municipios?orderBy=nome",
      { signal: SIGNAL },
    );
  });

  it("keeps valid items, trims names and coerces numeric string ids", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        { id: 1, nome: "  Rio Pomba " },
        { id: "2", nome: "Mercês" },
        { id: "abc", nome: "Id inválido" },
        { id: 3, nome: "   " },
        { id: 4, nome: 10 },
        { id: 5 },
        null,
        "texto",
      ]),
    );

    const result = await fetchMunicipios("MG", SIGNAL);

    expect(result).toEqual([
      { id: 1, nome: "Rio Pomba" },
      { id: 2, nome: "Mercês" },
    ]);
  });

  it("fails when the response is not ok", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([], false));

    await expect(fetchMunicipios("MG", SIGNAL)).rejects.toThrow("IBGE HTTP failure");
  });

  it("fails when the payload is not an array", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ nome: "x" }));

    await expect(fetchMunicipios("MG", SIGNAL)).rejects.toThrow("IBGE invalid response");
  });

  it("fails when no valid municipality remains", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: "x", nome: "A" }]));

    await expect(fetchMunicipios("MG", SIGNAL)).rejects.toThrow("IBGE empty response");
  });
});

describe("formatCep", () => {
  it.each([
    ["", ""],
    ["367", "367"],
    ["36700", "36700"],
    ["367001", "36700-1"],
    ["36700120", "36700-120"],
    ["36.700-120999", "36700-120"],
    ["ab36700cd120", "36700-120"],
  ])("formats %j as %j", (input, expected) => {
    expect(formatCep(input)).toBe(expected);
  });
});

describe("validateCep", () => {
  it("accepts an empty value", () => {
    expect(validateCep("")).toBeNull();
    expect(validateCep("--")).toBeNull();
  });

  it("accepts a CEP with 8 digits", () => {
    expect(validateCep("36700-120")).toBeNull();
  });

  it("rejects a CEP with fewer or more than 8 digits", () => {
    expect(validateCep("36700-12")).toBe(CEP_ERROR);
    expect(validateCep("367001200")).toBe(CEP_ERROR);
  });
});

describe("caretAfterDigits", () => {
  it("returns the index right after the requested number of digits", () => {
    expect(caretAfterDigits("36700-120", 3)).toBe(3);
    expect(caretAfterDigits("36700-120", 5)).toBe(5);
    expect(caretAfterDigits("36700-120", 6)).toBe(7);
  });

  it("returns zero when no digit precedes the caret", () => {
    expect(caretAfterDigits("36700-120", 0)).toBe(0);
  });

  it("returns the end when the caret is after every digit", () => {
    expect(caretAfterDigits("36700-120", 8)).toBe(9);
    expect(caretAfterDigits("", 0)).toBe(0);
  });
});

describe("applyCepPaste", () => {
  it("rebuilds a formatted value from pasted digits", () => {
    expect(applyCepPaste("", 0, 0, " 36.700-120 ")).toEqual({
      value: "36700-120",
      digitsBeforeCaret: 8,
    });
  });

  it("replaces the current selection", () => {
    expect(applyCepPaste("36700-120", 0, 9, "12345")).toEqual({
      value: "12345",
      digitsBeforeCaret: 5,
    });
  });

  it("inserts at the caret and truncates to 8 digits", () => {
    expect(applyCepPaste("367", 2, 2, "999999")).toEqual({
      value: "36999-999",
      digitsBeforeCaret: 8,
    });
  });

  it("ignores clipboard text without digits", () => {
    expect(applyCepPaste("367", 0, 0, "abc")).toBeNull();
  });
});

describe("readViaCep", () => {
  it("reads city and UF from a valid response", () => {
    expect(readViaCep({ localidade: "Rio Pomba", uf: " mg " })).toEqual({
      cidade: "Rio Pomba",
      uf: "MG",
    });
  });

  it("rejects non-object payloads", () => {
    expect(readViaCep(null)).toBeNull();
    expect(readViaCep("MG")).toBeNull();
  });

  it("rejects the ViaCEP not-found marker", () => {
    expect(readViaCep({ erro: true, localidade: "Rio Pomba", uf: "MG" })).toBeNull();
  });

  it("rejects a missing city or an unknown UF", () => {
    expect(readViaCep({ uf: "MG" })).toBeNull();
    expect(readViaCep({ localidade: "123", uf: "MG" })).toBeNull();
    expect(readViaCep({ localidade: "Rio Pomba", uf: "XX" })).toBeNull();
    expect(readViaCep({ localidade: "Rio Pomba" })).toBeNull();
  });
});
