import { describe, expect, it } from "vitest";
import {
  avisoStatusBusca,
  buscaEstaVazia,
  diasParaStatusVencer,
  disponivelAgora,
  hojeIso,
  resumoHabilitacao,
  resumoMobilidade,
  resumoPcd,
} from "@/lib/busca";
import { makeBusca } from "../components/profile/profileFixtures";

const NOW = new Date(2026, 9, 24, 12, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

describe("diasParaStatusVencer", () => {
  it("returns null when the status was never confirmed", () => {
    expect(diasParaStatusVencer(null, NOW)).toBeNull();
  });

  it("counts the days left of the 30 days", () => {
    expect(diasParaStatusVencer(new Date(NOW.getTime() - 25 * DAY_MS).toISOString(), NOW)).toBe(5);
    expect(diasParaStatusVencer(NOW.toISOString(), NOW)).toBe(30);
  });

  it("never goes below zero", () => {
    expect(diasParaStatusVencer(new Date(NOW.getTime() - 45 * DAY_MS).toISOString(), NOW)).toBe(0);
  });
});

describe("avisoStatusBusca", () => {
  const daysAgo = (days: number) => new Date(NOW.getTime() - days * DAY_MS).toISOString();

  it("has nothing to warn without a status", () => {
    expect(avisoStatusBusca(makeBusca(), NOW)).toBeNull();
  });

  it("warns that an outdated status may be shown as outdated to recruiters", () => {
    const busca = makeBusca({ status: "NAO_BUSCANDO", statusConfirmadoEm: daysAgo(40), statusDesatualizado: true });

    expect(avisoStatusBusca(busca, NOW)).toContain("sem confirmação há mais de 30 dias");
  });

  it("warns only from 7 days before the 30 days end", () => {
    const at = (days: number) =>
      avisoStatusBusca(makeBusca({ status: "ABERTO_A_PROPOSTAS", statusConfirmadoEm: daysAgo(days) }), NOW);

    expect(at(22)).toBeNull();
    expect(at(23)).toContain("vence em 7 dias");
    expect(at(29)).toContain("vence em 1 dia.");
    expect(at(30)).toContain("vence hoje");
  });
});

describe("resumos do que o aluno busca", () => {
  it("lists only the mobility answers that are yes", () => {
    expect(resumoMobilidade(makeBusca())).toEqual([]);
    expect(resumoMobilidade(makeBusca({ aceitaMudarDeCidade: true }))).toEqual(["Aceita mudar de cidade"]);
  });

  it("joins the license categories and the own vehicle", () => {
    expect(resumoHabilitacao(makeBusca())).toEqual([]);
    expect(resumoHabilitacao(makeBusca({ categoriasCnh: ["A", "B"], possuiVeiculoProprio: true }))).toEqual([
      "CNH A, B",
      "Veículo próprio",
    ]);
    expect(resumoHabilitacao(makeBusca({ possuiVeiculoProprio: true }))).toEqual(["Veículo próprio"]);
  });

  it("describes the PCD answers with their types", () => {
    expect(resumoPcd(makeBusca())).toEqual([]);
    expect(
      resumoPcd(makeBusca({ pcd: { souPcd: true, interesseVagaPcd: true, tipos: ["VISUAL", "TEA"], consentimentoEm: null } })),
    ).toEqual(["Pessoa com deficiência · Visual · Transtorno do espectro autista (TEA)", "Interesse em vagas para PCD"]);
  });
});

describe("hojeIso", () => {
  it("formats the local date as yyyy-MM-dd", () => {
    expect(hojeIso(NOW)).toBe("2026-10-24");
    expect(hojeIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("disponivelAgora", () => {
  it("is true for the immediate flag, today and past dates", () => {
    expect(disponivelAgora(makeBusca({ disponivelImediatamente: true }), NOW)).toBe(true);
    expect(disponivelAgora(makeBusca({ disponivelAPartirDe: "2026-10-24" }), NOW)).toBe(true);
    expect(disponivelAgora(makeBusca({ disponivelAPartirDe: "2020-01-01" }), NOW)).toBe(true);
  });

  it("is false for a future date or nothing informed", () => {
    expect(disponivelAgora(makeBusca({ disponivelAPartirDe: "2026-10-25" }), NOW)).toBe(false);
    expect(disponivelAgora(makeBusca(), NOW)).toBe(false);
  });
});

describe("buscaEstaVazia", () => {
  it("is empty only when nothing was informed", () => {
    expect(buscaEstaVazia(makeBusca(), [], [])).toBe(true);
    expect(buscaEstaVazia(makeBusca(), ["CLT"], [])).toBe(false);
    expect(buscaEstaVazia(makeBusca(), [], ["REMOTO"])).toBe(false);
    expect(buscaEstaVazia(makeBusca({ aceitaViajar: true }), [], [])).toBe(false);
    expect(buscaEstaVazia(makeBusca({ categoriasCnh: ["B"] }), [], [])).toBe(false);
    expect(
      buscaEstaVazia(
        makeBusca({ pcd: { souPcd: false, interesseVagaPcd: true, tipos: [], consentimentoEm: null } }),
        [],
        [],
      ),
    ).toBe(false);
  });
});
