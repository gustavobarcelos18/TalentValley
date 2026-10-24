// Backend student profile contracts (GET /api/alunos/me and section mutations).
// Field names mirror the ASP.NET DTOs serialized as camelCase; enums travel as strings.

export type TipoDisponibilidade = "ESTAGIO" | "CLT" | "PJ" | "FREELANCER" | "TRAINEE";

export type ModalidadeTrabalho = "PRESENCIAL" | "HIBRIDO" | "REMOTO";

export type StatusBusca = "BUSCANDO_ATIVAMENTE" | "ABERTO_A_PROPOSTAS" | "NAO_BUSCANDO";

export type CargaHorariaSemanal = "ATE_20H" | "ATE_30H" | "ATE_40H";

export type CategoriaCnh = "A" | "B" | "C" | "D" | "E";

export type TipoDeficiencia = "FISICA" | "VISUAL" | "AUDITIVA" | "INTELECTUAL" | "MULTIPLA" | "TEA" | "OUTRA";

export type AreaInteresse =
  | "DesenvolvimentoBackend"
  | "DesenvolvimentoFrontend"
  | "DesenvolvimentoFullStack"
  | "DesenvolvimentoMobile"
  | "DesenvolvimentoJogos"
  | "DadosAnalytics"
  | "CienciaDadosIa"
  | "BancoDeDados"
  | "InfraestruturaNuvem"
  | "DevOps"
  | "SegurancaInformacao"
  | "TestesQualidadeQa"
  | "SuporteTecnico"
  | "Redes"
  | "AutomacaoIot"
  | "GestaoProjetos"
  | "Agilidade"
  | "GestaoProduto"
  | "AnaliseNegociosRequisitos"
  | "ProcessosQualidade"
  | "Inovacao"
  | "EmpreendedorismoStartups"
  | "Administracao"
  | "FinancasContabilidade"
  | "VendasComercial"
  | "AtendimentoSucessoCliente"
  | "PessoasRh"
  | "LogisticaOperacoes"
  | "ComprasSuprimentos"
  | "MarketingDigital"
  | "DesignInterfacesUiUx"
  | "DesignGrafico"
  | "ProducaoConteudoRedacao"
  | "MidiasSociais"
  | "Audiovisual";

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
  cidade: string | null;
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

export type TipoCompetencia = "TECNICA" | "COMPORTAMENTAL";

export interface CompetenciaResponse {
  id: number;
  nome: string;
  tipo: TipoCompetencia;
}

export interface AlunoIdiomaResponse {
  idiomaId: number;
  nome: string;
  nivel: NivelIdioma;
}

export interface CatalogoCompetenciaResponse {
  id: number;
  nome: string;
  categoria: string;
  tipo: TipoCompetencia;
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

export interface FormacaoRequest {
  tipo: TipoFormacao;
  nome: string;
  instituicao: string;
  dataInicio: string;
  dataFim: string | null;
  cargaHoraria: number | null;
  status: StatusFormacao;
  principal: boolean;
  ehRioPombaValley: boolean;
}

export interface ExperienciaRequest {
  empresa: string;
  cargo: string;
  tipo: TipoExperiencia;
  dataInicio: string;
  dataFim: string | null;
  atual: boolean;
  descricao: string | null;
}

export interface ProjetoRequest {
  ordem: number;
  nome: string;
  dataInicio: string;
  dataFim: string | null;
  emAndamento: boolean;
  descricao: string;
  demoUrl: string | null;
  repositorioUrl: string | null;
  competenciaIds: number[];
}

export type TipoItemTrajetoria = "FORMACAO" | "EXPERIENCIA";

export interface TrajetoriaItemResponse {
  tipoItem: TipoItemTrajetoria;
  id: string;
  titulo: string;
  subtitulo: string;
  dataInicio: string;
  dataFim: string | null;
  atual: boolean;
  formacao: FormacaoResponse | null;
  experiencia: ExperienciaResponse | null;
}

export interface PcdResponse {
  souPcd: boolean;
  interesseVagaPcd: boolean;
  tipos: TipoDeficiencia[];
  consentimentoEm: string | null;
}

// "O que eu busco". statusDesatualizado is computed by the backend (not confirmed for over 30 days).
export interface BuscaResponse {
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
  pcd: PcdResponse;
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
  busca: BuscaResponse;
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

// PUT /api/alunos/me/disponibilidade: the whole "O que eu busco" form, always a full replacement.
export interface UpdateDisponibilidadeRequest {
  disponibilidades: TipoDisponibilidade[];
  modalidades: ModalidadeTrabalho[];
  statusBusca: StatusBusca | null;
  objetivoProfissional: string | null;
  areasInteresse: AreaInteresse[];
  disponivelImediatamente: boolean;
  disponivelAPartirDe: string | null;
  cargaHorariaSemanal: CargaHorariaSemanal | null;
  aceitaViajar: boolean;
  aceitaMudarDeCidade: boolean;
  categoriasCnh: CategoriaCnh[];
  possuiVeiculoProprio: boolean;
  souPcd: boolean;
  interesseVagaPcd: boolean;
  tiposDeficiencia: TipoDeficiencia[];
  consentimentoPcd: boolean;
}
