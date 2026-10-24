import type { TalentBusca, TalentFormation, TalentListItem, TalentProfile } from "@/types/recruiter";

/** "O que eu busco" with nothing informed; pass `overrides` for the fields a test cares about. */
export function makeTalentBusca(overrides: Partial<TalentBusca> = {}): TalentBusca {
  return {
    status: null,
    statusConfirmadoEm: null,
    statusDesatualizado: false,
    objetivo: null,
    areasInteresse: [],
    disponivelImediatamente: false,
    disponivelAPartirDe: null,
    cargaHoraria: null,
    aceitaViajar: false,
    aceitaMudarDeCidade: false,
    categoriasCnh: [],
    possuiVeiculoProprio: false,
    pcd: null,
    ...overrides,
  };
}

/** Fully populated talent list item; pass `overrides` for the fields a test cares about. */
export function makeTalentListItem(overrides: Partial<TalentListItem> = {}): TalentListItem {
  return {
    id: "talento-1",
    slug: "maria-souza",
    nomeCompleto: "Maria Souza",
    fotoUrl: null,
    cidade: "Rio Pomba",
    uf: "MG",
    bio: "Estudante de sistemas de informação.",
    competencias: [{ id: 1, nome: "React", tipo: "TECNICA" }],
    formacaoPrincipal: {
      tipo: "GRADUACAO",
      nome: "Sistemas de Informação",
      instituicao: "IF Sudeste MG",
      rpvVerificado: false,
    },
    disponibilidades: ["ESTAGIO"],
    modalidades: ["REMOTO"],
    busca: makeTalentBusca(),
    favorito: false,
    atualizadoEm: "2026-09-01T12:00:00Z",
    rpvVerificado: false,
    ...overrides,
  };
}

/** Fully populated talent profile; pass `overrides` for the fields a test cares about. */
export function makeTalentProfile(overrides: Partial<TalentProfile> = {}): TalentProfile {
  return {
    id: "talento-1",
    slug: "maria-souza",
    nomeCompleto: "Maria Souza",
    fotoUrl: null,
    cidade: "Rio Pomba",
    uf: "MG",
    contato: {
      telefone: "32999998888",
      emailProfissional: "maria@example.com",
      linkedInUrl: "https://linkedin.com/in/maria",
      gitHubUrl: "https://github.com/maria",
      portfolioUrl: "https://maria.dev",
    },
    bio: "Estudante de sistemas de informação.",
    competencias: [{ id: 1, nome: "React", tipo: "TECNICA" }],
    idiomas: [{ idiomaId: 1, nome: "Inglês", nivel: "INTERMEDIARIO" }],
    disponibilidades: ["ESTAGIO"],
    modalidades: ["REMOTO"],
    busca: makeTalentBusca(),
    formacoes: [],
    experiencias: [],
    projetos: [],
    curriculo: { possuiCurriculo: false, url: null },
    favorito: false,
    atualizadoEm: "2026-09-01T12:00:00Z",
    ...overrides,
  };
}

/** Main, in-progress degree formation; pass `overrides` for the fields a test cares about. */
export function makeFormation(overrides: Partial<TalentFormation> = {}): TalentFormation {
  return {
    id: "f-1",
    tipo: "GRADUACAO",
    nome: "Sistemas de Informação",
    instituicao: "IF Sudeste MG",
    dataInicio: "2022-02-01",
    dataFim: null,
    cargaHoraria: null,
    status: "EM_ANDAMENTO",
    principal: true,
    rpvVerificado: false,
    possuiCertificado: false,
    certificadoUrl: null,
    ...overrides,
  };
}
