// Backend student profile contracts (GET /api/alunos/me and section mutations).
// Field names mirror the ASP.NET DTOs serialized as camelCase; enums travel as strings.

export type TipoDisponibilidade = "ESTAGIO" | "CLT" | "PJ" | "FREELANCER" | "TRAINEE";

export type ModalidadeTrabalho = "PRESENCIAL" | "HIBRIDO" | "REMOTO";

export type NivelIdioma = "BASICO" | "INTERMEDIARIO" | "AVANCADO" | "FLUENTE" | "NATIVO";

// Trajectory enums are only used to type GET /api/alunos/me fully; their sections
// are out of scope for the student profile core.
export type TipoFormacao = "CURSO_LIVRE" | "TECNICO" | "TECNOLOGO" | "GRADUACAO" | "POS_GRADUACAO";

export type StatusFormacao = "EM_ANDAMENTO" | "CONCLUIDO" | "TRANCADO";

export type StatusValidacaoRpv = "PENDENTE" | "VERIFICADO" | "REJEITADO";

export type TipoExperiencia = "PROFISSIONAL" | "ESTAGIO";

export interface DadosBasicosResponse {
  nomeCompleto: string;
  fotoUrl: string | null;
  cidade: string;
  uf: string | null;
}

export interface SobreResponse {
  bio: string | null;
}

export interface ContatoResponse {
  telefone: string | null;
  emailProfissional: string | null;
  linkedInUrl: string | null;
  gitHubUrl: string | null;
  portfolioUrl: string | null;
}

export interface CurriculoResponse {
  possuiCurriculo: boolean;
  nomeArquivo: string | null;
}

export interface CompetenciaResponse {
  id: number;
  nome: string;
}

export interface AlunoIdiomaResponse {
  idiomaId: number;
  nome: string;
  nivel: NivelIdioma;
}

export interface CatalogoCompetenciaResponse {
  id: number;
  nome: string;
}

export interface CatalogoIdiomaResponse {
  id: number;
  nome: string;
}

export interface FormacaoResponse {
  id: string;
  tipo: TipoFormacao;
  nome: string;
  instituicao: string;
  dataInicio: string;
  dataFim: string | null;
  cargaHoraria: number | null;
  status: StatusFormacao;
  principal: boolean;
  ehRioPombaValley: boolean;
  statusValidacaoRpv: StatusValidacaoRpv | null;
  possuiCertificado: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ExperienciaResponse {
  id: string;
  empresa: string;
  cargo: string;
  tipo: TipoExperiencia;
  dataInicio: string;
  dataFim: string | null;
  atual: boolean;
  descricao: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ProjetoResponse {
  id: string;
  ordem: number;
  nome: string;
  dataInicio: string;
  dataFim: string | null;
  emAndamento: boolean;
  descricao: string;
  demoUrl: string | null;
  repositorioUrl: string | null;
  competencias: CompetenciaResponse[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface MeResponse {
  id: string;
  slug: string;
  dadosBasicos: DadosBasicosResponse;
  sobre: SobreResponse;
  contato: ContatoResponse;
  competencias: CompetenciaResponse[];
  idiomas: AlunoIdiomaResponse[];
  disponibilidades: TipoDisponibilidade[];
  modalidades: ModalidadeTrabalho[];
  formacoes: FormacaoResponse[];
  experiencias: ExperienciaResponse[];
  projetos: ProjetoResponse[];
  curriculo: CurriculoResponse;
  atualizadoEm: string;
}

export interface UpdateDadosBasicosRequest {
  nomeCompleto: string;
  cidade: string;
  uf: string;
}

export interface UpdateSobreRequest {
  bio: string | null;
}

export interface UpdateContatoRequest {
  telefone: string | null;
  emailProfissional: string | null;
  linkedInUrl: string | null;
  gitHubUrl: string | null;
  portfolioUrl: string | null;
}

export interface UpdateCompetenciasRequest {
  competenciaIds: number[];
}

export interface ItemIdiomaRequest {
  idiomaId: number;
  nivel: NivelIdioma;
}

export interface UpdateIdiomasRequest {
  idiomas: ItemIdiomaRequest[];
}

export interface UpdateDisponibilidadeRequest {
  disponibilidades: TipoDisponibilidade[];
  modalidades: ModalidadeTrabalho[];
}
