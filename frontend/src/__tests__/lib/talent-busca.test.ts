import { describe, expect, it } from "vitest";
import { avisoStatusDesatualizado, etiquetasPcd, habilitacaoBusca, inicioBusca, linhaBusca, mesAno } from "@/lib/talent-busca";
import { makeTalentBusca } from "../components/recruiter/recruiterFixtures";

const HOJE = new Date(2026, 9, 24);

describe("mesAno", () => {
  it.each([
    ["2027-01-15", "jan/2027"],
    ["2026-12-01", "dez/2026"],
  ])("formats %s as %s", (iso, expected) => {
    expect(mesAno(iso)).toBe(expected);
  });
});

describe("inicioBusca", () => {
  it("is immediate when flagged or when the date is today or past", () => {
    expect(inicioBusca(makeTalentBusca({ disponivelImediatamente: true }), HOJE)).toBe("início imediato");
    expect(inicioBusca(makeTalentBusca({ disponivelAPartirDe: "2026-10-24" }), HOJE)).toBe("início imediato");
    expect(inicioBusca(makeTalentBusca({ disponivelAPartirDe: "2026-01-01" }), HOJE)).toBe("início imediato");
  });

  it("shows month and year for a future date and nothing when not informed", () => {
    expect(inicioBusca(makeTalentBusca({ disponivelAPartirDe: "2027-01-15" }), HOJE)).toBe("a partir de jan/2027");
    expect(inicioBusca(makeTalentBusca(), HOJE)).toBeNull();
  });
});

describe("linhaBusca", () => {
  it("joins job types, modalities and the start", () => {
    const busca = makeTalentBusca({ disponivelAPartirDe: "2027-01-15" });
    expect(linhaBusca(["ESTAGIO", "CLT"], ["HIBRIDO"], busca, HOJE)).toBe("Estágio · CLT · Híbrido · a partir de jan/2027");
  });

  it("is empty when nothing was informed", () => {
    expect(linhaBusca([], [], makeTalentBusca(), HOJE)).toBe("");
  });
});

describe("avisoStatusDesatualizado", () => {
  it("warns only when the backend flags the status as outdated", () => {
    expect(avisoStatusDesatualizado(makeTalentBusca({ status: "NAO_BUSCANDO" }))).toBeNull();
    expect(avisoStatusDesatualizado(makeTalentBusca({ status: "ABERTO_A_PROPOSTAS", statusDesatualizado: true }))).toBe(
      "Status não confirmado há mais de 30 dias",
    );
  });
});

describe("habilitacaoBusca", () => {
  it("lists the license categories and the own vehicle", () => {
    expect(habilitacaoBusca(makeTalentBusca({ categoriasCnh: ["A", "B"], possuiVeiculoProprio: true }))).toEqual(["CNH A, B", "veículo próprio"]);
    expect(habilitacaoBusca(makeTalentBusca({ possuiVeiculoProprio: true }))).toEqual(["veículo próprio"]);
  });

  it("is empty when nothing was informed", () => {
    expect(habilitacaoBusca(makeTalentBusca())).toEqual([]);
  });
});

describe("etiquetasPcd", () => {
  it("is empty without consent (null) or when every answer is no", () => {
    expect(etiquetasPcd(null)).toEqual([]);
    expect(etiquetasPcd({ souPcd: false, interesseVagaPcd: false, tipos: [] })).toEqual([]);
  });

  it("lists the types after the neutral label and the interest separately", () => {
    expect(etiquetasPcd({ souPcd: true, interesseVagaPcd: false, tipos: ["VISUAL", "AUDITIVA"] })).toEqual([
      "Pessoa com deficiência · visual · auditiva",
    ]);
    expect(etiquetasPcd({ souPcd: false, interesseVagaPcd: true, tipos: [] })).toEqual(["Interesse em vaga PCD"]);
  });
});
