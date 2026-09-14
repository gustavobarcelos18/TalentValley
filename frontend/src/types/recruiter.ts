import type {
  ModalidadeTrabalho,
  NivelIdioma,
  StatusFormacao,
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
}

export interface TalentFormationPreview {
  tipo: TipoFormacao;
  nome: string;
  instituicao: string;
  rpvVerificado: boolean;
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
  favorito: boolean;
  atualizadoEm: string;
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
  ordenacao: TalentSort | null;
}
