import type {
  AdminFormation,
  AdminRegistrationRequest,
  AdminRegistrationRequestDetail,
  AdminStudentDetail,
} from "@/types/admin";

/** Fully populated admin student detail; pass `overrides` for the fields a test cares about. */
export function makeAdminStudentDetail(
  overrides: Partial<AdminStudentDetail> = {},
): AdminStudentDetail {
  return {
    id: "aluno-1",
    slug: "maria-souza",
    nomeCompleto: "Maria Souza",
    ativo: true,
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
    competencias: [{ id: 1, nome: "React" }],
    idiomas: [{ idiomaId: 1, nome: "Inglês", nivel: "INTERMEDIARIO" }],
    disponibilidades: ["ESTAGIO"],
    modalidades: ["REMOTO"],
    formacoes: [],
    experiencias: [],
    projetos: [],
    curriculo: { possuiCurriculo: false, url: null },
    atualizadoEm: "2026-09-01T12:00:00Z",
    ...overrides,
  };
}

/** Student detail with every optional section empty. */
export function makeEmptyAdminStudentDetail(
  overrides: Partial<AdminStudentDetail> = {},
): AdminStudentDetail {
  return makeAdminStudentDetail({
    cidade: null,
    uf: null,
    bio: null,
    contato: {
      telefone: null,
      emailProfissional: null,
      linkedInUrl: null,
      gitHubUrl: null,
      portfolioUrl: null,
    },
    competencias: [],
    idiomas: [],
    disponibilidades: [],
    modalidades: [],
    ...overrides,
  });
}

/** In-progress degree formation that is not part of Rio Pomba Valley. */
export function makeAdminFormation(
  overrides: Partial<AdminFormation> = {},
): AdminFormation {
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
    ehRioPombaValley: false,
    statusValidacaoRpv: null,
    possuiCertificado: false,
    certificadoUrl: null,
    ...overrides,
  };
}

/** Pending student registration request; pass `overrides` for the fields a test cares about. */
export function makeStudentRequest(
  overrides: Partial<AdminRegistrationRequest> = {},
): AdminRegistrationRequest {
  return {
    id: "req-aluno",
    tipo: "ALUNO",
    status: "PENDENTE",
    nomeCompleto: "Ana Lima",
    email: "ana@example.com",
    telefone: "(32) 99999-8888",
    cidade: "Rio Pomba",
    uf: "MG",
    instituicaoEnsino: "IF Sudeste MG",
    curso: "Sistemas de Informação",
    tipoFormacao: "GRADUACAO",
    anoConclusaoPrevisto: 2027,
    empresa: null,
    cargo: null,
    criadoEm: "2026-09-01T12:00:00Z",
    ...overrides,
  };
}

/** Pending recruiter registration request. */
export function makeRecruiterRequest(
  overrides: Partial<AdminRegistrationRequest> = {},
): AdminRegistrationRequest {
  return makeStudentRequest({
    id: "req-recrutador",
    tipo: "RECRUTADOR",
    nomeCompleto: "Bruno Reis",
    email: "bruno@empresa.com",
    instituicaoEnsino: null,
    curso: null,
    tipoFormacao: null,
    anoConclusaoPrevisto: null,
    empresa: "Empresa X",
    cargo: "Gerente de RH",
    ...overrides,
  });
}

/** Detail of a student registration request, with every optional field filled. */
export function makeStudentRequestDetail(
  overrides: Partial<AdminRegistrationRequestDetail> = {},
): AdminRegistrationRequestDetail {
  return {
    ...makeStudentRequest(),
    relacaoRioPombaValley: "Egresso do curso técnico",
    siteEmpresa: null,
    analisadoEm: null,
    adminEmail: null,
    motivoRejeicao: null,
    ...overrides,
  };
}

/** Detail of a recruiter registration request, with every optional field filled. */
export function makeRecruiterRequestDetail(
  overrides: Partial<AdminRegistrationRequestDetail> = {},
): AdminRegistrationRequestDetail {
  return {
    ...makeRecruiterRequest(),
    relacaoRioPombaValley: null,
    siteEmpresa: "https://empresa.com",
    analisadoEm: null,
    adminEmail: null,
    motivoRejeicao: null,
    ...overrides,
  };
}
