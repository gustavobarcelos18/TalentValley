import type { UserRole } from "@/types/auth";
import type {
  AreaInteresse,
  CargaHorariaSemanal,
  CategoriaCnh,
  ModalidadeTrabalho,
  NivelIdioma,
  StatusBusca,
  StatusFormacao,
  StatusValidacaoRpv,
  TipoDeficiencia,
  TipoDisponibilidade,
  TipoExperiencia,
  TipoFormacao,
} from "@/types/student";

// Friendly Portuguese labels for backend enum values. The exact backend values
// are always what gets sent to the API.

export const ROLE_LABELS: Record<UserRole, string> = {
  ALUNO: "Aluno",
  RECRUTADOR: "Recrutador",
  ADMIN: "Admin",
};

export const DISPONIBILIDADE_LABELS: Record<TipoDisponibilidade, string> = {
  ESTAGIO: "Estágio",
  CLT: "CLT",
  PJ: "PJ",
  FREELANCER: "Freelancer",
  TRAINEE: "Trainee",
};

export const MODALIDADE_LABELS: Record<ModalidadeTrabalho, string> = {
  PRESENCIAL: "Presencial",
  HIBRIDO: "Híbrido",
  REMOTO: "Remoto",
};

export const STATUS_BUSCA_LABELS: Record<StatusBusca, string> = {
  BUSCANDO_ATIVAMENTE: "Buscando ativamente",
  ABERTO_A_PROPOSTAS: "Aberto a propostas",
  NAO_BUSCANDO: "Não estou buscando agora",
};

export const CARGA_HORARIA_LABELS: Record<CargaHorariaSemanal, string> = {
  ATE_20H: "Até 20 horas por semana",
  ATE_30H: "Até 30 horas por semana",
  ATE_40H: "Até 40 horas por semana (integral)",
};

export const CATEGORIA_CNH_LABELS: Record<CategoriaCnh, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
  E: "E",
};

export const TIPO_DEFICIENCIA_LABELS: Record<TipoDeficiencia, string> = {
  FISICA: "Física",
  VISUAL: "Visual",
  AUDITIVA: "Auditiva",
  INTELECTUAL: "Intelectual",
  MULTIPLA: "Múltipla",
  TEA: "Transtorno do espectro autista (TEA)",
  OUTRA: "Outra",
};

export const AREA_INTERESSE_LABELS: Record<AreaInteresse, string> = {
  DesenvolvimentoBackend: "Desenvolvimento back-end",
  DesenvolvimentoFrontend: "Desenvolvimento front-end",
  DesenvolvimentoFullStack: "Desenvolvimento full stack",
  DesenvolvimentoMobile: "Desenvolvimento mobile",
  DesenvolvimentoJogos: "Desenvolvimento de jogos",
  DadosAnalytics: "Dados e analytics",
  CienciaDadosIa: "Ciência de dados e IA",
  BancoDeDados: "Banco de dados",
  InfraestruturaNuvem: "Infraestrutura e nuvem",
  DevOps: "DevOps",
  SegurancaInformacao: "Segurança da informação",
  TestesQualidadeQa: "Testes e qualidade (QA)",
  SuporteTecnico: "Suporte técnico",
  Redes: "Redes",
  AutomacaoIot: "Automação e IoT",
  GestaoProjetos: "Gestão de projetos",
  Agilidade: "Agilidade",
  GestaoProduto: "Gestão de produto",
  AnaliseNegociosRequisitos: "Análise de negócios e requisitos",
  ProcessosQualidade: "Processos e qualidade",
  Inovacao: "Inovação",
  EmpreendedorismoStartups: "Empreendedorismo e startups",
  Administracao: "Administração",
  FinancasContabilidade: "Finanças e contabilidade",
  VendasComercial: "Vendas e comercial",
  AtendimentoSucessoCliente: "Atendimento e sucesso do cliente",
  PessoasRh: "Pessoas e RH",
  LogisticaOperacoes: "Logística e operações",
  ComprasSuprimentos: "Compras e suprimentos",
  MarketingDigital: "Marketing digital",
  DesignInterfacesUiUx: "Design de interfaces (UI/UX)",
  DesignGrafico: "Design gráfico",
  ProducaoConteudoRedacao: "Produção de conteúdo e redação",
  MidiasSociais: "Mídias sociais",
  Audiovisual: "Audiovisual",
};

// Interest areas grouped for the picker. The order is the order shown to the student.
export const AREA_INTERESSE_GRUPOS: { titulo: string; areas: AreaInteresse[] }[] = [
  {
    titulo: "Tecnologia",
    areas: [
      "DesenvolvimentoBackend",
      "DesenvolvimentoFrontend",
      "DesenvolvimentoFullStack",
      "DesenvolvimentoMobile",
      "DesenvolvimentoJogos",
      "DadosAnalytics",
      "CienciaDadosIa",
      "BancoDeDados",
      "InfraestruturaNuvem",
      "DevOps",
      "SegurancaInformacao",
      "TestesQualidadeQa",
      "SuporteTecnico",
      "Redes",
      "AutomacaoIot",
    ],
  },
  {
    titulo: "Gestão de projetos e processos",
    areas: ["GestaoProjetos", "Agilidade", "GestaoProduto", "AnaliseNegociosRequisitos", "ProcessosQualidade"],
  },
  { titulo: "Inovação e empreendedorismo", areas: ["Inovacao", "EmpreendedorismoStartups"] },
  {
    titulo: "Negócios",
    areas: [
      "Administracao",
      "FinancasContabilidade",
      "VendasComercial",
      "AtendimentoSucessoCliente",
      "PessoasRh",
      "LogisticaOperacoes",
      "ComprasSuprimentos",
    ],
  },
  {
    titulo: "Marketing, design e comunicação",
    areas: [
      "MarketingDigital",
      "DesignInterfacesUiUx",
      "DesignGrafico",
      "ProducaoConteudoRedacao",
      "MidiasSociais",
      "Audiovisual",
    ],
  },
];

export const NIVEL_IDIOMA_LABELS: Record<NivelIdioma, string> = {
  BASICO: "Básico",
  INTERMEDIARIO: "Intermediário",
  AVANCADO: "Avançado",
  FLUENTE: "Fluente",
  NATIVO: "Nativo",
};

export const TIPO_FORMACAO_LABELS: Record<TipoFormacao, string> = {
  CURSO_LIVRE: "Curso livre",
  TECNICO: "Técnico",
  TECNOLOGO: "Tecnólogo",
  GRADUACAO: "Graduação",
  POS_GRADUACAO: "Pós-graduação",
};

export const STATUS_FORMACAO_LABELS: Record<StatusFormacao, string> = {
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDO: "Concluído",
  TRANCADO: "Trancado",
};

export const STATUS_VALIDACAO_RPV_LABELS: Record<StatusValidacaoRpv, string> = {
  PENDENTE: "Aguardando validação",
  VERIFICADO: "Verificado pelo Rio Pomba Valley",
  REJEITADO: "Validação não aprovada",
};

export const TIPO_EXPERIENCIA_LABELS: Record<TipoExperiencia, string> = {
  PROFISSIONAL: "Profissional",
  ESTAGIO: "Estágio",
};

export const DISPONIBILIDADE_OPCOES = Object.keys(DISPONIBILIDADE_LABELS) as TipoDisponibilidade[];

export const MODALIDADE_OPCOES = Object.keys(MODALIDADE_LABELS) as ModalidadeTrabalho[];

export const STATUS_BUSCA_OPCOES = Object.keys(STATUS_BUSCA_LABELS) as StatusBusca[];

export const CARGA_HORARIA_OPCOES = Object.keys(CARGA_HORARIA_LABELS) as CargaHorariaSemanal[];

export const CATEGORIA_CNH_OPCOES = Object.keys(CATEGORIA_CNH_LABELS) as CategoriaCnh[];

export const TIPO_DEFICIENCIA_OPCOES = Object.keys(TIPO_DEFICIENCIA_LABELS) as TipoDeficiencia[];

// Same order as the grouped picker, so the options of each group stay together.
export const AREA_INTERESSE_OPCOES: AreaInteresse[] = AREA_INTERESSE_GRUPOS.flatMap((grupo) => grupo.areas);

export const NIVEL_IDIOMA_OPCOES = Object.keys(NIVEL_IDIOMA_LABELS) as NivelIdioma[];
