import type { ChangeEvent, ClipboardEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BRAZILIAN_UFS,
  PASSWORD_RULES,
  containsEmoji,
  digitsOnly,
  formatBrazilianPhone,
  maskBrazilianPhone,
  maskPhoneChange,
  normalizeEmailInput,
  normalizeOptionalUrl,
  normalizePhone,
  normalizeUF,
  normalizeWhitespace,
  sanitizeBio,
  sanitizeObjetivo,
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
  validateDatePeriod,
  validateDateRange,
  validateEmail,
  validateFreeText,
  validateMultilineText,
  validateHttpUrl,
  validateTypedLink,
  withHttpsScheme,
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
  validateWorkloadHours,
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

  it("shows a stored number by its length, even when a 10-digit number starts with 9", () => {
    expect(formatBrazilianPhone("3299991234")).toBe("(32) 9999-1234");
    expect(formatBrazilianPhone("32999991234")).toBe("(32) 99999-1234");
  });

  it("keeps the phone hyphen in place while a mobile number is typed", () => {
    expect(formatBrazilianPhone("329999", true)).toBe("(32) 9999");
    expect(formatBrazilianPhone("3299999", true)).toBe("(32) 99999");
    expect(formatBrazilianPhone("32999991", true)).toBe("(32) 99999-1");
    expect(formatBrazilianPhone("3233334", true)).toBe("(32) 3333-4");
  });

  it("masks phone input as digits only, capped at 11, without an explicit +55", () => {
    expect(maskBrazilianPhone("")).toBe("");
    expect(maskBrazilianPhone("abc")).toBe("");
    expect(maskBrazilianPhone("(32) 99999-1234")).toBe("(32) 99999-1234");
    expect(maskBrazilianPhone("+55 (32) 99999-1234")).toBe("(32) 99999-1234");
    expect(maskBrazilianPhone("+55 3233334444")).toBe("(32) 3333-4444");
    expect(maskBrazilianPhone("5532999991234")).toBe("(32) 99999-1234");
    expect(maskBrazilianPhone("329999912349999")).toBe("(32) 99999-1234");
  });

  it("keeps 55 as the area code when it is not an explicit country code", () => {
    expect(maskBrazilianPhone("55")).toBe("(55");
    expect(maskBrazilianPhone("55912345678")).toBe("(55) 91234-5678");
    // A 12th digit is dropped; it never turns the 55 into a country code.
    expect(maskBrazilianPhone("559123456781")).toBe("(55) 91234-5678");
    expect(maskBrazilianPhone("(55) 33334-4445")).toBe("(55) 33334-4445");
  });

  describe("maskPhoneChange caret", () => {
    const frames: FrameRequestCallback[] = [];

    beforeEach(() => {
      frames.length = 0;
      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    function change(value: string, selectionStart: number | null) {
      const setSelectionRange = vi.fn();
      const event = {
        currentTarget: { value, selectionStart, setSelectionRange },
      } as unknown as ChangeEvent<HTMLInputElement>;
      const masked = maskPhoneChange(event);
      for (const frame of frames) frame(0);
      return { masked, setSelectionRange };
    }

    it("puts the caret after the digit that was just typed in the middle of the number", () => {
      // "(32) 98888-7777" with a "1" typed after the 9: the caret stays right after the typed digit.
      const { masked, setSelectionRange } = change("(32) 918888-7777", 7);

      expect(masked).toBe("(32) 91888-8777");
      expect(setSelectionRange).toHaveBeenCalledWith(7, 7);
    });

    it("moves the caret past the separators the mask adds", () => {
      const { masked, setSelectionRange } = change("32988", 5);

      expect(masked).toBe("(32) 988");
      expect(setSelectionRange).toHaveBeenCalledWith(8, 8);
    });

    it("ignores the dropped country code when counting digits before the caret", () => {
      const { masked, setSelectionRange } = change("+55 32 98888-7777", 8);

      expect(masked).toBe("(32) 98888-7777");
      expect(setSelectionRange).toHaveBeenCalledWith(6, 6);
    });

    it("keeps the area code 55 and the caret in place when a digit is inserted", () => {
      const { masked, setSelectionRange } = change("(55) 912345-678", 12);

      expect(masked).toBe("(55) 91234-5678");
      expect(setSelectionRange).toHaveBeenCalledWith(12, 12);
    });

    it("falls back to the end of the value when the caret is unknown", () => {
      const { masked, setSelectionRange } = change("32988887777", null);

      expect(setSelectionRange).toHaveBeenCalledWith(masked.length, masked.length);
    });
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

  it("sanitizes the professional goal: no emoji, no line breaks, at most 280 characters", () => {
    expect(sanitizeObjetivo("meta 😀")).toBe("meta ");
    expect(sanitizeObjetivo("linha 1\r\nlinha 2\tfim")).toBe("linha 1 linha 2 fim");
    expect(sanitizeObjetivo("a\u0000b\u007Fc\u0085d")).toBe("a b c d");
    expect(sanitizeObjetivo("a".repeat(400))).toHaveLength(280);
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

  it("validates the area code and the first digit of a Brazilian phone", () => {
    // Area codes run from 11 to 99.
    expect(validateBrazilianPhone("(11) 91234-5678")).toBeNull();
    expect(validateBrazilianPhone("(99) 91234-5678")).toBeNull();
    for (const invalid of ["(10) 91234-5678", "(01) 91234-5678", "(00) 91234-5678"]) {
      expect(validateBrazilianPhone(invalid)).toBe(phoneError);
    }
    // 11 digits (mobile) must start with 9 after the area code.
    expect(validateBrazilianPhone("(32) 98888-7777")).toBeNull();
    expect(validateBrazilianPhone("(32) 88888-7777")).toBe(phoneError);
    expect(validateBrazilianPhone("(32) 12345-6789")).toBe(phoneError);
    // 10 digits (landline) must start with 2 to 5 after the area code.
    for (const valid of ["(32) 2333-4444", "(32) 3333-4444", "(32) 4333-4444", "(32) 5333-4444"]) {
      expect(validateBrazilianPhone(valid)).toBeNull();
    }
    for (const invalid of ["(32) 1333-4444", "(32) 6333-4444", "(32) 9333-4444"]) {
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

  it("requires a domain with a dot and completes typed links with https://", () => {
    expect(validateHttpUrl("https://localhost")).toBe("Informe uma URL válida.");
    expect(validateHttpUrl("https://exemplo.")).toBe("Informe uma URL válida.");
    expect(withHttpsScheme("  github.com/maria ")).toBe("https://github.com/maria");
    expect(withHttpsScheme("http://exemplo.com")).toBe("http://exemplo.com");
    expect(withHttpsScheme("ftp://exemplo.com")).toBe("ftp://exemplo.com");
    expect(withHttpsScheme("javascript:alert(1)")).toBe("javascript:alert(1)");
    expect(withHttpsScheme("exemplo.com:8080/x")).toBe("https://exemplo.com:8080/x");
    expect(withHttpsScheme("   ")).toBe("");
    expect(normalizeOptionalUrl("exemplo.com")).toBe("https://exemplo.com");
  });

  it("validates typed links, optionally for one site", () => {
    expect(validateTypedLink("")).toBeNull();
    expect(validateTypedLink("exemplo.com")).toBeNull();
    expect(validateTypedLink("exemplo")).toBe("Informe uma URL válida.");
    expect(validateTypedLink("ftp://exemplo.com")).toBe("Informe uma URL começando com http:// ou https://.");
    const github = { domain: "github.com", name: "GitHub" };
    expect(validateTypedLink("github.com/maria", github)).toBeNull();
    expect(validateTypedLink("https://www.github.com/maria", github)).toBeNull();
    expect(validateTypedLink("", github)).toBeNull();
    expect(validateTypedLink("https://evilgithub.com/maria", github)).toBe("Informe um link do GitHub (github.com).");
    expect(validateTypedLink("https://github.com.evil.com/maria", github)).toBe("Informe um link do GitHub (github.com).");
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
    expect(validateMeaningfulText("a", 2, 10, "um cargo válido")).toBe("Informe um cargo válido.");
    expect(validateMeaningfulText("a😀b", 2, 10)).toBe(invalidValue);
    for (const validate of [validateCompanyName, validateJobTitle, validateInstitutionName, validateCourseName, validateProjectName]) {
      expect(validate("Nome Válido")).toBeNull();
      expect(validate("")).toMatch(/^Informe .+ válid[oa]\.$/);
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
    expect(validateFreeText("a\nb", 5)).toBe("Revise o texto informado.");
  });

  it("validates multiline text, which accepts paragraph breaks", () => {
    expect(validateMultilineText("ok", 5)).toBeNull();
    expect(validateMultilineText("a\nb", 5)).toBeNull();
    expect(validateMultilineText("a\r\nb\n\nc", 9)).toBeNull();
    for (const invalid of ["longo demais", "a\nlongo", "a\u0007", "a\n\u0007b", "oi\n😀"]) {
      expect(validateMultilineText(invalid, 5)).toBe("Revise o texto informado.");
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

  it("limits Brazilian dates to 1900 and fifteen years ahead", () => {
    const lastYear = new Date().getFullYear() + 15;
    const rangeError = `Informe uma data entre 1900 e ${lastYear}.`;
    expect(validateBrazilianDateInput("01/01/1900")).toBeNull();
    expect(validateBrazilianDateInput("31/12/1899")).toBe(rangeError);
    expect(validateBrazilianDateInput(`31/12/${lastYear}`)).toBeNull();
    expect(validateBrazilianDateInput(`01/01/${lastYear + 1}`)).toBe(rangeError);
    expect(validateBrazilianDateInput("31/04/1850")).toBe(invalidDate);
  });

  it("validates a start and an end date together", () => {
    expect(validateDatePeriod("01/02/2023", "31/01/2024")).toEqual({ start: null, end: null });
    expect(validateDatePeriod("01/02/2023", null)).toEqual({ start: null, end: null });
    expect(validateDatePeriod("01/02/2023", "01/02/2023")).toEqual({ start: null, end: null });
    expect(validateDatePeriod("", null).start).toBe("Informe a data de início.");
    expect(validateDatePeriod("0102", null).start).toBe("Use o formato dd/mm/aaaa.");
    expect(validateDatePeriod("01/02/2023", "31/02/2024").end).toBe(invalidDate);
    expect(validateDatePeriod("01/02/2023", "31/01/2023").end).toBe("A data final não pode ser anterior à data inicial.");
    expect(validateDatePeriod("01/02/2023", "", "Informe o fim.").end).toBe("Informe o fim.");
    expect(validateDatePeriod("01/02/2023", null, "Informe o fim.").end).toBe("Informe o fim.");
    expect(validateDatePeriod("01/02/2023", "31/01/2024", "Informe o fim.").end).toBeNull();
    // The order is only compared when both dates are valid on their own.
    expect(validateDatePeriod("31/02/2023", "01/01/2020")).toEqual({ start: invalidDate, end: null });
  });

  it("limits the workload to 1 through 10,000 hours", () => {
    const workloadError = "Informe uma carga horária de 1 a 10.000 horas.";
    expect(validateWorkloadHours(null)).toBeNull();
    expect(validateWorkloadHours(1)).toBeNull();
    expect(validateWorkloadHours(10000)).toBeNull();
    expect(validateWorkloadHours(0)).toBe(workloadError);
    expect(validateWorkloadHours(10001)).toBe(workloadError);
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
