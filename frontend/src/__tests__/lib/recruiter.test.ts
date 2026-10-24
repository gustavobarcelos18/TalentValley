import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addFavorite,
  fetchFavorites,
  fetchRecruiterCompetencies,
  fetchRecruiterDashboard,
  fetchTalent,
  fetchTalentComparison,
  fetchTalents,
  removeFavorite,
  talentSearchParams,
} from "@/lib/recruiter";
import { apiGet, apiMutation } from "@/lib/api";
import type { TalentSearchFilters } from "@/types/recruiter";

vi.mock("@/lib/api");

const EMPTY: TalentSearchFilters = {
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
};

const TALENTS_PATH = "/api/talentos";
const FAVORITES_PATH = "/api/recrutador/favoritos";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("talentSearchParams", () => {
  it("is empty for the default filters", () => {
    expect(talentSearchParams(EMPTY).toString()).toBe("");
  });

  it("serializes every filter, repeating multi-value keys and lowercasing the sort", () => {
    const params = talentSearchParams({
      page: 3,
      nome: "Ana",
      cidade: "Rio Pomba",
      uf: "MG",
      competenciaIds: [4, 7],
      tiposFormacao: ["TECNICO", "GRADUACAO"],
      formacaoNome: "ADS",
      statusFormacao: ["CONCLUIDO"],
      rpvVerificado: true,
      disponibilidades: ["CLT", "PJ"],
      modalidades: ["REMOTO"],
      statusBusca: ["BUSCANDO_ATIVAMENTE", "ABERTO_A_PROPOSTAS"],
      areasInteresse: ["DevOps", "DadosAnalytics"],
      aceitaViajar: true,
      aceitaMudarDeCidade: true,
      categoriasCnh: ["A", "B"],
      interesseVagaPcd: true,
      ordenacao: "RECENTES",
    });

    expect(params.get("page")).toBe("3");
    expect(params.get("nome")).toBe("Ana");
    expect(params.get("cidade")).toBe("Rio Pomba");
    expect(params.get("uf")).toBe("MG");
    expect(params.getAll("competenciaIds")).toEqual(["4", "7"]);
    expect(params.getAll("tiposFormacao")).toEqual(["TECNICO", "GRADUACAO"]);
    expect(params.get("formacaoNome")).toBe("ADS");
    expect(params.getAll("statusFormacao")).toEqual(["CONCLUIDO"]);
    expect(params.get("rpvVerificado")).toBe("true");
    expect(params.getAll("disponibilidades")).toEqual(["CLT", "PJ"]);
    expect(params.getAll("modalidades")).toEqual(["REMOTO"]);
    expect(params.getAll("statusBusca")).toEqual(["BUSCANDO_ATIVAMENTE", "ABERTO_A_PROPOSTAS"]);
    expect(params.getAll("areasInteresse")).toEqual(["DevOps", "DadosAnalytics"]);
    expect(params.get("aceitaViajar")).toBe("true");
    expect(params.get("aceitaMudarDeCidade")).toBe("true");
    expect(params.getAll("categoriasCnh")).toEqual(["A", "B"]);
    expect(params.get("interesseVagaPcd")).toBe("true");
    expect(params.get("ordenacao")).toBe("recentes");
  });
});

describe("recruiter requests", () => {
  it("fetchTalents omits the query string without filters and appends it otherwise", () => {
    fetchTalents(EMPTY);
    fetchTalents({ ...EMPTY, nome: "Ana" });

    expect(apiGet).toHaveBeenNthCalledWith(1, TALENTS_PATH);
    expect(apiGet).toHaveBeenNthCalledWith(2, `${TALENTS_PATH}?nome=Ana`);
  });

  it.each([
    ["fetchRecruiterDashboard", () => fetchRecruiterDashboard(), "/api/recrutador/dashboard"],
    ["fetchTalent encodes the slug", () => fetchTalent("ana silva/1"), `${TALENTS_PATH}/ana%20silva%2F1`],
    ["fetchRecruiterCompetencies", () => fetchRecruiterCompetencies(), "/api/competencias"],
    ["fetchFavorites", () => fetchFavorites(2), `${FAVORITES_PATH}?page=2`],
    ["fetchTalentComparison", () => fetchTalentComparison(["a", "b"]), "/api/recrutador/comparar?slugs=a&slugs=b"],
  ])("%s", (_name, call, path) => {
    call();

    expect(apiGet).toHaveBeenCalledWith(path);
  });

  it("adds and removes favorites with an encoded slug", () => {
    addFavorite("ana silva");
    removeFavorite("ana silva");

    expect(apiMutation).toHaveBeenNthCalledWith(1, "POST", `${FAVORITES_PATH}/ana%20silva`);
    expect(apiMutation).toHaveBeenNthCalledWith(2, "DELETE", `${FAVORITES_PATH}/ana%20silva`);
  });
});
