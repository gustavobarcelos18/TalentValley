import { describe, expect, it } from "vitest";
import { hasTalentFilters, parseTalentSearch } from "@/lib/recruiter-search";

function parse(query: string) {
  return parseTalentSearch(new URLSearchParams(query));
}

describe("parseTalentSearch", () => {
  it("returns the empty filters for an empty query", () => {
    expect(parse("")).toEqual({
      page: 1,
      nome: "",
      cidade: "",
      uf: "",
      competenciaIds: [],
      tiposFormacao: [],
      formacaoNome: "",
      statusFormacao: [],
      rpvVerificado: false,
      disponibilidades: [],
      modalidades: [],
      statusBusca: [],
      areasInteresse: [],
      aceitaViajar: false,
      aceitaMudarDeCidade: false,
      categoriasCnh: [],
      interesseVagaPcd: false,
      ordenacao: null,
    });
  });

  it("reads and normalizes every filter", () => {
    const filters = parse(
      "page=4&nome=%20Ana%20&cidade=Rio%20Pomba&uf=mg&competenciaIds=3&competenciaIds=5&tiposFormacao=tecnico&tiposFormacao=GRADUACAO" +
        "&formacaoNome=ADS&statusFormacao=concluido&rpvVerificado=TRUE&disponibilidades=clt&modalidades=remoto&ordenacao=nome" +
        "&statusBusca=buscando_ativamente&areasInteresse=devops&areasInteresse=DesenvolvimentoBackend&aceitaViajar=TRUE" +
        "&aceitaMudarDeCidade=true&categoriasCnh=b&categoriasCnh=E&interesseVagaPcd=true",
    );

    expect(filters).toEqual({
      page: 4,
      nome: "Ana",
      cidade: "Rio Pomba",
      uf: "MG",
      competenciaIds: [3, 5],
      tiposFormacao: ["TECNICO", "GRADUACAO"],
      formacaoNome: "ADS",
      statusFormacao: ["CONCLUIDO"],
      rpvVerificado: true,
      disponibilidades: ["CLT"],
      modalidades: ["REMOTO"],
      statusBusca: ["BUSCANDO_ATIVAMENTE"],
      areasInteresse: ["DevOps", "DesenvolvimentoBackend"],
      aceitaViajar: true,
      aceitaMudarDeCidade: true,
      categoriasCnh: ["B", "E"],
      interesseVagaPcd: true,
      ordenacao: "NOME",
    });
  });

  it("drops invalid 'o que eu busco' values and flags other than true", () => {
    const filters = parse(
      "statusBusca=talvez&areasInteresse=Inexistente&categoriasCnh=Z&categoriasCnh=a&aceitaViajar=1&interesseVagaPcd=false",
    );

    expect(filters.statusBusca).toEqual([]);
    expect(filters.areasInteresse).toEqual([]);
    expect(filters.categoriasCnh).toEqual(["A"]);
    expect(filters.aceitaViajar).toBe(false);
    expect(filters.interesseVagaPcd).toBe(false);
  });

  it.each(["0", "-2", "abc", "214748365"])("falls back to page 1 for page=%s", (page) => {
    expect(parse(`page=${page}`).page).toBe(1);
  });

  it("accepts the largest allowed page", () => {
    expect(parse("page=214748364").page).toBe(214_748_364);
  });

  it("drops invalid, duplicated and out-of-range values", () => {
    const filters = parse(
      "uf=MGX&competenciaIds=0&competenciaIds=-1&competenciaIds=x&competenciaIds=2147483648&competenciaIds=7&competenciaIds=7" +
        "&tiposFormacao=INVALIDO&tiposFormacao=tecnico&tiposFormacao=TECNICO&modalidades=outra&ordenacao=aleatoria&rpvVerificado=false",
    );

    expect(filters.uf).toBe("");
    expect(parse("uf=ZZ").uf).toBe("");
    expect(filters.competenciaIds).toEqual([7]);
    expect(filters.tiposFormacao).toEqual(["TECNICO"]);
    expect(filters.modalidades).toEqual([]);
    expect(filters.ordenacao).toBeNull();
    expect(filters.rpvVerificado).toBe(false);
  });

  it("accepts the largest competency id", () => {
    expect(parse("competenciaIds=2147483647").competenciaIds).toEqual([2_147_483_647]);
  });
});

describe("hasTalentFilters", () => {
  it("is false for the default filters, even with page and sort set", () => {
    expect(hasTalentFilters({ ...parse(""), page: 3, ordenacao: "NOME" })).toBe(false);
  });

  it.each([
    "nome=Ana",
    "cidade=Rio",
    "uf=MG",
    "competenciaIds=1",
    "tiposFormacao=TECNICO",
    "formacaoNome=ADS",
    "statusFormacao=CONCLUIDO",
    "rpvVerificado=true",
    "disponibilidades=CLT",
    "modalidades=REMOTO",
    "statusBusca=NAO_BUSCANDO",
    "areasInteresse=DevOps",
    "aceitaViajar=true",
    "aceitaMudarDeCidade=true",
    "categoriasCnh=B",
    "interesseVagaPcd=true",
  ])("is true for %s", (query) => {
    expect(hasTalentFilters(parse(query))).toBe(true);
  });
});
