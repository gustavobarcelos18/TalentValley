import type {
  AreaInteresse,
  CargaHorariaSemanal,
  CategoriaCnh,
  ModalidadeTrabalho,
  NivelIdioma,
  StatusBusca,
  StatusFormacao,
  TipoCompetencia,
  TipoDeficiencia,
  TipoDisponibilidade,
  TipoExperiencia,
  TipoFormacao,
} from "@/types/student";

export type TalentSort = "RELEVANCIA" | "RECENTES" | "NOME";

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface TalentCompetency {
  id: number;
  nome: string;
  tipo: TipoCompetencia;
}

export interface TalentFormationPreview {
  tipo: TipoFormacao;
  nome: string;
  instituicao: string;
  rpvVerificado: boolean;
}

// PCD information; the backend only sends it (pcd !== null) when the student gave consent.
export interface TalentPcd {
  souPcd: boolean;
  interesseVagaPcd: boolean;
  tipos: TipoDeficiencia[];
}

// "O que eu busco" as recruiters and admins see it. statusDesatualizado is computed by the backend.
export interface TalentBusca {
  status: StatusBusca | null;
  statusConfirmadoEm: string | null;
  statusDesatualizado: boolean;
  objetivo: string | null;
  areasInteresse: AreaInteresse[];
  disponivelImediatamente: boolean;
  disponivelAPartirDe: string | null;
  cargaHoraria: CargaHorariaSemanal | null;
  aceitaViajar: boolean;
  aceitaMudarDeCidade: boolean;
  categoriasCnh: CategoriaCnh[];
  possuiVeiculoProprio: boolean;
  pcd: TalentPcd | null;
}

export interface TalentListItem {
  id: string;
  slug: string;
  nomeCompleto: string;
  fotoUrl: string | null;
  cidade: string | null;
  uf: string | null;
  bio: string | null;
  competencias: TalentCompetency[];
  formacaoPrincipal: TalentFormationPreview | null;
  disponibilidades: TipoDisponibilidade[];
  modalidades: ModalidadeTrabalho[];
  busca: TalentBusca;
  favorito: boolean;
  atualizadoEm: string;
  rpvVerificado: boolean;
}

export interface TalentContact {
  telefone: string | null;
  emailProfissional: string | null;
  linkedInUrl: string | null;
  gitHubUrl: string | null;
  portfolioUrl: string | null;
}

export interface TalentLanguage {
  idiomaId: number;
  nome: string;
  nivel: NivelIdioma;
}

export interface TalentFormation {
  id: string;
  tipo: TipoFormacao;
  nome: string;
  instituicao: string;
  dataInicio: string;
  dataFim: string | null;
  cargaHoraria: number | null;
  status: StatusFormacao;
  principal: boolean;
  rpvVerificado: boolean;
  possuiCertificado: boolean;
  certificadoUrl: string | null;
}

export interface TalentExperience {
  id: string;
  empresa: string;
  cargo: string;
  tipo: TipoExperiencia;
  dataInicio: string;
  dataFim: string | null;
  atual: boolean;
  descricao: string | null;
}

export interface TalentProject {
  id: string;
  ordem: number;
  nome: string;
  dataInicio: string;
  dataFim: string | null;
  emAndamento: boolean;
  descricao: string;
  demoUrl: string | null;
  repositorioUrl: string | null;
  tecnologias: TalentCompetency[];
}

export interface TalentProfile {
  id: string;
  slug: string;
  nomeCompleto: string;
  fotoUrl: string | null;
  cidade: string | null;
  uf: string | null;
  contato: TalentContact;
  bio: string | null;
  competencias: TalentCompetency[];
  idiomas: TalentLanguage[];
  disponibilidades: TipoDisponibilidade[];
  modalidades: ModalidadeTrabalho[];
  busca: TalentBusca;
  formacoes: TalentFormation[];
  experiencias: TalentExperience[];
  projetos: TalentProject[];
  curriculo: { possuiCurriculo: boolean; url: string | null };
  favorito: boolean;
  atualizadoEm: string;
}

export interface FavoriteTalent {
  favoritadoEm: string;
  talento: TalentListItem;
}

export interface TalentCommon {
  competencias: TalentCompetency[];
  disponibilidades: TipoDisponibilidade[];
  modalidades: ModalidadeTrabalho[];
  areasInteresse: AreaInteresse[];
  categoriasCnh: CategoriaCnh[];
}

export interface TalentComparison {
  talentoA: TalentProfile;
  emComum: TalentCommon;
  talentoB: TalentProfile;
}

export interface RecruiterDashboard {
  desdeUltimoAcesso: string | null;
  indicadores: {
    perfisAtualizadosDesdeUltimoAcesso: number;
    novosAlunosDesdeUltimoAcesso: number;
    favoritos: number;
  };
  favoritosRecentes: FavoriteTalent[];
}

export interface TalentSearchFilters {
  page: number;
  nome: string;
  cidade: string;
  uf: string;
  competenciaIds: number[];
  tiposFormacao: TipoFormacao[];
  formacaoNome: string;
  statusFormacao: StatusFormacao[];
  rpvVerificado: boolean;
  disponibilidades: TipoDisponibilidade[];
  modalidades: ModalidadeTrabalho[];
  statusBusca: StatusBusca[];
  areasInteresse: AreaInteresse[];
  aceitaViajar: boolean;
  aceitaMudarDeCidade: boolean;
  categoriasCnh: CategoriaCnh[];
  interesseVagaPcd: boolean;
  ordenacao: TalentSort | null;
}
