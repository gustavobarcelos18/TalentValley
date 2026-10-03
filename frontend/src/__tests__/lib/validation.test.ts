import type { ClipboardEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BRAZILIAN_UFS,
  PASSWORD_RULES,
  containsEmoji,
  digitsOnly,
  formatBrazilianPhone,
  normalizeEmailInput,
  normalizeOptionalUrl,
  normalizePhone,
  normalizeUF,
  normalizeWhitespace,
  sanitizeBio,
  sanitizeCityName,
  sanitizeIntegerInput,
  sanitizePersonName,
  stripEmoji,
  stripEmojiOnPaste,
  validateAlphaOnly,
  validateAlphanumericWithPunctuation,
  validateBrazilianDateInput,
  validateBrazilianPhone,
  validateCityName,
  validateCompanyName,
  validateCourseName,
  validateDateRange,
  validateEmail,
  validateFreeText,
  validateHttpUrl,
  validateInstitutionName,
  validateInteger,
  validateIntegerRange,
  validateIsoDate,
  validateJobTitle,
  validateMeaningfulText,
  validatePassword,
  validatePersonName,
  validatePositiveInteger,
  validateProjectName,
  validateRequired,
  validateSearchTerm,
  validateTextLength,
  validateUF,
  validateYear,
} from "@/lib/validation";

const invalidValue = "Informe um valor válido.";
const onlyNumbers = "Use apenas números.";
const invalidDate = "Informe uma data válida.";

describe("emoji handling", () => {
  it("removes pictographs, skin tones, flags and tag characters", () => {
    expect(stripEmoji("Olá 😀 mundo")).toBe("Olá  mundo");
    expect(stripEmoji("ok👍🏽")).toBe("ok");
    expect(stripEmoji("br🇧🇷")).toBe("br");
    expect(stripEmoji("a\u{E0067}b")).toBe("ab");
  });

  it("removes joiners, variation selectors and the keycap mark on their own", () => {
    expect(stripEmoji("a\uFE0Fb")).toBe("ab");
    expect(stripEmoji("a\u200Db")).toBe("ab");
    expect(stripEmoji("a\u20E3b")).toBe("ab");
  });

  it("removes whole keycap sequences, with and without the variation selector", () => {
    expect(stripEmoji("1\uFE0F\u20E3")).toBe("");
    expect(stripEmoji("#\u20E3 e *\uFE0F\u20E3")).toBe(" e ");
  });

  it("removes composed emoji sequences completely", () => {
    expect(stripEmoji("👨\u200D👩\u200D👧")).toBe("");
  });

  it("keeps plain digits, letters and symbols", () => {
    expect(stripEmoji("Rua 10, #5 * ok")).toBe("Rua 10, #5 * ok");
  });

  it("detects the same characters it removes", () => {
    expect(containsEmoji("abc")).toBe(false);
    expect(containsEmoji("Rua 10, #5")).toBe(false);
    expect(containsEmoji("oi 😀")).toBe(true);
    expect(containsEmoji("a\uFE0F")).toBe(true);
    expect(containsEmoji("a\u200D")).toBe(true);
    expect(containsEmoji("a\u20E3")).toBe(true);
    expect(containsEmoji("\u{1F1E7}")).toBe(true);
    expect(containsEmoji("5\uFE0F\u20E3")).toBe(true);
  });
});

describe("stripEmojiOnPaste", () => {
  // jsdom has no document.execCommand, so each test installs a spy and removes it afterwards.
  const execCommand = vi.fn();

  beforeEach(() => {
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
  });

  afterEach(() => {
    Reflect.deleteProperty(document, "execCommand");
    execCommand.mockReset();
  });

  function pasteEvent(text: string) {
    const preventDefault = vi.fn();
    const getData = vi.fn(() => text);
    const event = { clipboardData: { getData }, preventDefault } as unknown as ClipboardEvent<HTMLInputElement>;
    return { event, preventDefault, getData };
  }

  it("lets a paste without emoji proceed", () => {
    const { event, preventDefault, getData } = pasteEvent("texto simples");
    stripEmojiOnPaste(event);
    expect(getData).toHaveBeenCalledWith("text/plain");
    expect(preventDefault).not.toHaveBeenCalled();
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("blocks the paste and inserts the text without emoji", () => {
    const { event, preventDefault } = pasteEvent("oi 😀!");
    stripEmojiOnPaste(event);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(execCommand).toHaveBeenCalledWith("insertText", false, "oi !");
  });
});

describe("normalizers and sanitizers", () => {
  it("normalizes whitespace, e-mail, digits and optional URL", () => {
    expect(normalizeWhitespace("  a   b \n c ")).toBe("a b c");
    expect(normalizeEmailInput("  Ana@Exemplo.COM ")).toBe("ana@exemplo.com");
    expect(digitsOnly("(32) 9-1234")).toBe("3291234");
    expect(normalizeOptionalUrl("  https://exemplo.com ")).toBe("https://exemplo.com");
    expect(normalizeOptionalUrl("   ")).toBeNull();
  });

  it("normalizes Brazilian phone numbers without the country code", () => {
    expect(normalizePhone("+55 (32) 99999-1234")).toBe("32999991234");
    expect(normalizePhone("553299991234")).toBe("3299991234");
    expect(normalizePhone("(32) 3333-4444")).toBe("3233334444");
  });

  it("formats phone numbers while typing", () => {
    expect(formatBrazilianPhone("")).toBe("");
    expect(formatBrazilianPhone("3")).toBe("(3");
    expect(formatBrazilianPhone("32")).toBe("(32");
    expect(formatBrazilianPhone("32123")).toBe("(32) 123");
    expect(formatBrazilianPhone("3212345")).toBe("(32) 1234-5");
    expect(formatBrazilianPhone("3233334444")).toBe("(32) 3333-4444");
    expect(formatBrazilianPhone("32999991234")).toBe("(32) 99999-1234");
  });

  it("normalizes the UF", () => {
    expect(normalizeUF(" mgx ")).toBe("MG");
    expect(BRAZILIAN_UFS).toHaveLength(27);
  });

  it("sanitizes names, cities, integers and bio", () => {
    expect(sanitizePersonName("Ana 123😀")).toBe("Ana ");
    expect(sanitizePersonName("a".repeat(200))).toHaveLength(150);
    expect(sanitizeCityName("Rio 2 Pomba😀")).toBe("Rio  Pomba");
    expect(sanitizeCityName("a".repeat(200))).toHaveLength(120);
    expect(sanitizeIntegerInput("a1b2c3")).toBe("123");
    expect(sanitizeIntegerInput("123456", 2)).toBe("12");
    expect(sanitizeBio("bio 😀")).toBe("bio ");
    expect(sanitizeBio("a".repeat(2000))).toHaveLength(1500);
  });
});

describe("required, names and e-mail", () => {
  it("validates required values", () => {
    expect(validateRequired("x")).toBeNull();
    expect(validateRequired("   ")).toBe("Este campo é obrigatório.");
    expect(validateRequired(null, "Nome")).toBe("Nome é obrigatório.");
    expect(validateRequired(undefined)).toBe("Este campo é obrigatório.");
  });

  it("validates person names", () => {
    expect(validatePersonName("Maria Silva")).toBeNull();
    expect(validatePersonName("D'Ávila Souza")).toBeNull();
    for (const invalid of ["Jo", "Maria1", "Maria 😀", "a".repeat(151), "-Maria"]) {
      expect(validatePersonName(invalid)).toBe("Informe um nome válido, sem números.");
    }
  });

  it("validates city names", () => {
    expect(validateCityName("Rio Pomba")).toBeNull();
    for (const invalid of ["A", "Rio 2", "a".repeat(121)]) {
      expect(validateCityName(invalid)).toBe("Informe uma cidade válida, sem números.");
    }
  });

  it("validates e-mail addresses", () => {
    expect(validateEmail("ana@exemplo.com")).toBeNull();
    expect(validateEmail("")).toBe("Informe seu e-mail.");
    expect(validateEmail("", false)).toBeNull();
    for (const invalid of ["semarroba", "a b@exemplo.com", "a@b", "a😀@exemplo.com", `${"a".repeat(250)}@b.co`]) {
      expect(validateEmail(invalid)).toBe("Informe um e-mail válido.");
    }
  });
});

describe("phone, UF and URL", () => {
  const phoneError = "Informe um telefone brasileiro válido.";

  it("validates Brazilian phones", () => {
    expect(validateBrazilianPhone("(32) 99999-1234")).toBeNull();
    expect(validateBrazilianPhone("+55 32 3333-4444")).toBeNull();
    expect(validateBrazilianPhone("")).toBe(phoneError);
    expect(validateBrazilianPhone("", false)).toBeNull();
    for (const invalid of ["abc", "123", "11111111111", "0012345678"]) {
      expect(validateBrazilianPhone(invalid)).toBe(phoneError);
    }
  });

  it("validates UFs", () => {
    expect(validateUF(" mg ")).toBeNull();
    expect(validateUF("XX")).toBe("Selecione uma UF válida.");
  });

  it("validates http(s) URLs", () => {
    expect(validateHttpUrl("https://exemplo.com/caminho")).toBeNull();
    expect(validateHttpUrl("http://exemplo.com")).toBeNull();
    expect(validateHttpUrl("")).toBeNull();
    expect(validateHttpUrl(undefined)).toBeNull();
    expect(validateHttpUrl("", true)).toBe("Informe uma URL.");
    expect(validateHttpUrl("ftp://exemplo.com")).toBe("Informe uma URL começando com http:// ou https://.");
    expect(validateHttpUrl("não é url")).toBe("Informe uma URL válida.");
    expect(validateHttpUrl("exemplo")).toBe("Informe uma URL válida.");
    expect(validateHttpUrl("https://exemplo.com/😀")).toBe("Informe uma URL válida.");
  });
});

describe("search, text and free text", () => {
  it("validates search terms", () => {
    expect(validateSearchTerm("react")).toBeNull();
    expect(validateSearchTerm("a".repeat(151))).toBe("A busca deve ter no máximo 150 caracteres.");
    expect(validateSearchTerm("abcdef", 3)).toBe("A busca deve ter no máximo 3 caracteres.");
    expect(validateSearchTerm("a\u0007")).toBe("Informe uma busca válida.");
    expect(validateSearchTerm("😀")).toBe("Informe uma busca válida.");
  });

  it("validates text length", () => {
    expect(validateTextLength("abc", 1, 5)).toBeNull();
    expect(validateTextLength("abc", 1, 2, "o nome")).toBe("Informe o nome entre 1 e 2 caracteres.");
    expect(validateTextLength("", 1, 2)).toBe("Informe valor entre 1 e 2 caracteres.");
    expect(validateTextLength("a😀", 1, 5)).toBe("Informe valor entre 1 e 5 caracteres.");
  });

  it("validates meaningful text and its named wrappers", () => {
    expect(validateMeaningfulText("ab", 2, 10)).toBeNull();
    expect(validateMeaningfulText("--", 2, 10)).toBe(invalidValue);
    expect(validateMeaningfulText("a", 2, 10, "um cargo")).toBe("Informe um cargo válido.");
    expect(validateMeaningfulText("a😀b", 2, 10)).toBe(invalidValue);
    for (const validate of [validateCompanyName, validateJobTitle, validateInstitutionName, validateCourseName, validateProjectName]) {
      expect(validate("Nome Válido")).toBeNull();
      expect(validate("")).toMatch(/válido\.$/);
    }
    expect(validateAlphaOnly("ab")).toBeNull();
    expect(validateAlphaOnly("a")).toBe(invalidValue);
    expect(validateAlphanumericWithPunctuation("a")).toBeNull();
    expect(validateAlphanumericWithPunctuation("")).toBe(invalidValue);
  });

  it("validates free text", () => {
    expect(validateFreeText("ok", 5)).toBeNull();
    for (const invalid of ["longo demais", "a\u0007", "oi 😀"]) {
      expect(validateFreeText(invalid, 5)).toBe("Revise o texto informado.");
    }
  });
});

describe("numbers and years", () => {
  it("validates integers", () => {
    expect(validateInteger("12")).toBeNull();
    expect(validateInteger(12)).toBeNull();
    expect(validateInteger("")).toBeNull();
    expect(validateInteger(null)).toBeNull();
    expect(validateInteger(undefined, true)).toBe(onlyNumbers);
    expect(validateInteger("1.5")).toBe(onlyNumbers);
  });

  it("validates positive integers", () => {
    expect(validatePositiveInteger("3")).toBeNull();
    expect(validatePositiveInteger("0")).toBe("Informe um número positivo.");
    expect(validatePositiveInteger("x")).toBe(onlyNumbers);
    expect(validatePositiveInteger(null)).toBeNull();
    expect(validatePositiveInteger(null, true)).toBe(onlyNumbers);
  });

  it("validates integer ranges", () => {
    expect(validateIntegerRange("5", 1, 10)).toBeNull();
    expect(validateIntegerRange("11", 1, 10)).toBe("Informe um valor entre 1 e 10.");
    expect(validateIntegerRange("x", 1, 10)).toBe(onlyNumbers);
    expect(validateIntegerRange("", 1, 10)).toBeNull();
    expect(validateIntegerRange(null, 1, 10)).toBeNull();
  });

  it("validates years against the current year", () => {
    const currentYear = new Date().getFullYear();
    expect(validateYear("2024")).toBeNull();
    expect(validateYear(null)).toBeNull();
    expect(validateYear("")).toBeNull();
    expect(validateYear(2020)).toBeNull();
    expect(validateYear("99")).toBe("Informe um ano com 4 dígitos.");
    expect(validateYear("1800")).toBe(`Informe um ano entre 1900 e ${currentYear + 15}.`);
    expect(validateYear(String(currentYear + 16))).toBe(`Informe um ano entre 1900 e ${currentYear + 15}.`);
  });
});

describe("dates", () => {
  it("validates ISO dates", () => {
    expect(validateIsoDate("2024-02-29")).toBeNull();
    expect(validateIsoDate("")).toBeNull();
    expect(validateIsoDate("", true)).toBe("Informe uma data.");
    expect(validateIsoDate("2024-02-30")).toBe(invalidDate);
    expect(validateIsoDate("29/02/2024")).toBe(invalidDate);
  });

  it("validates Brazilian date input", () => {
    expect(validateBrazilianDateInput("")).toBeNull();
    expect(validateBrazilianDateInput("29/02/2024")).toBeNull();
    expect(validateBrazilianDateInput("31/04/2024")).toBe(invalidDate);
    expect(validateBrazilianDateInput("1/1/2024")).toBe("Use o formato dd/mm/aaaa.");
  });

  it("validates date ranges", () => {
    expect(validateDateRange("2024-01-01", "2024-02-01")).toBeNull();
    expect(validateDateRange("2024-01-01", "2024-01-01")).toBeNull();
    expect(validateDateRange(null, "2024-01-01")).toBeNull();
    expect(validateDateRange("2024-01-01", undefined)).toBeNull();
    expect(validateDateRange("2024-02-01", "2024-01-01")).toBe("A data final não pode ser anterior à data inicial.");
  });
});

describe("password", () => {
  it("reports the first unmet rule", () => {
    expect(validatePassword("Abcdef12")).toBeNull();
    expect(validatePassword("Ab1")).toBe("A senha deve ter pelo menos 8 caracteres.");
    expect(validatePassword("abcdefg1")).toBe("A senha deve conter pelo menos uma letra maiúscula.");
    expect(validatePassword("ABCDEFG1")).toBe("A senha deve conter pelo menos uma letra minúscula.");
    expect(validatePassword("Abcdefgh")).toBe("A senha deve conter pelo menos um dígito.");
  });

  it("keeps the live checklist in sync with the validator", () => {
    const passes = (value: string) => PASSWORD_RULES.every((rule) => rule.test(value));
    for (const value of ["Abcdef12", "Ab1", "abcdefg1", "ABCDEFG1", "Abcdefgh"]) {
      expect(passes(value)).toBe(validatePassword(value) === null);
    }
  });
});
