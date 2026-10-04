import { afterEach, describe, expect, it } from "vitest";
import { municipioCache } from "@/components/registration/location";
import {
  CONSENT_ERROR,
  commonBlank,
  commonErrors,
  firstError,
  validateConsent,
  type CommonForm,
} from "@/components/registration/registrationForm";

const CITY_STATE_ERROR = "A cidade informada não pertence ao estado selecionado.";
const CITY_FORMAT_ERROR = "Informe uma cidade válida, sem números.";

const validForm: CommonForm = {
  nomeCompleto: "Ana Souza",
  email: "ana@example.com",
  telefone: "(32) 99999-1234",
  cep: "36180-000",
  cidade: "Rio Pomba",
  uf: "MG",
};

afterEach(() => {
  municipioCache.clear();
});

describe("validateConsent", () => {
  it("returns no error when accepted", () => {
    expect(validateConsent(true)).toBeNull();
  });

  it("returns the consent error when not accepted", () => {
    expect(validateConsent(false)).toBe(CONSENT_ERROR);
  });
});

describe("commonErrors", () => {
  it("reports no error for a valid form", () => {
    expect(Object.values(commonErrors(validForm)).every((error) => error === null)).toBe(true);
  });

  it("reports an error for every required field of a blank form", () => {
    const errors = commonErrors(commonBlank);

    expect(Object.keys(errors)).toEqual(["nomeCompleto", "email", "telefone", "cep", "cidade", "uf"]);
    expect(errors.cep).toBeNull();
    expect([errors.nomeCompleto, errors.email, errors.telefone, errors.cidade, errors.uf].every(Boolean)).toBe(true);
  });

  it("accepts a city that belongs to the loaded municipality list of the UF", () => {
    municipioCache.set("MG", [{ id: 1, nome: "Rio Pomba" }]);

    expect(commonErrors({ ...validForm, cidade: "rio  pomba" }).cidade).toBeNull();
  });

  it("rejects a city missing from the loaded municipality list of the UF", () => {
    municipioCache.set("MG", [{ id: 1, nome: "Mercês" }]);

    expect(commonErrors(validForm).cidade).toBe(CITY_STATE_ERROR);
  });

  it("does not enforce the city and UF pair when the list is not loaded", () => {
    expect(commonErrors(validForm).cidade).toBeNull();
  });

  it("prefers the city format error over the city and UF mismatch", () => {
    municipioCache.set("MG", [{ id: 1, nome: "Mercês" }]);

    expect(commonErrors({ ...validForm, cidade: "R1o" }).cidade).toBe(CITY_FORMAT_ERROR);
  });
});

describe("firstError", () => {
  it("returns the first non-empty error in field order", () => {
    expect(firstError({ a: null, b: "", c: "Erro C", d: "Erro D" })).toBe("Erro C");
  });

  it("returns null when there is no error", () => {
    expect(firstError({ a: null, b: "" })).toBeNull();
    expect(firstError({})).toBeNull();
  });
});
