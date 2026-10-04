import type {
  AdminRecruiter,
  AdminRecruiterCreated,
  AdminRecruiterDetail,
  AuditItem,
  RpvValidation,
  RpvValidationDetail,
} from "@/types/admin";

export function makeAdminRecruiter(
  overrides: Partial<AdminRecruiter> = {},
): AdminRecruiter {
  return {
    id: "rec-1",
    nomeCompleto: "Carla Mendes",
    empresa: "Vale Tech",
    cargo: "Analista de RH",
    cidade: "Rio Pomba",
    uf: "MG",
    status: "ATIVO",
    ultimoAcessoEm: "2026-09-01T12:00:00Z",
    ...overrides,
  };
}

export function makeAdminRecruiterDetail(
  overrides: Partial<AdminRecruiterDetail> = {},
): AdminRecruiterDetail {
  return {
    ...makeAdminRecruiter(),
    email: "carla@valetech.com.br",
    telefone: "32991234567",
    ...overrides,
  };
}

export function makeAdminRecruiterCreated(
  overrides: Partial<AdminRecruiterCreated> = {},
): AdminRecruiterCreated {
  return {
    id: "rec-new",
    nomeCompleto: "Paulo Ramos",
    email: "paulo@valetech.com.br",
    status: "ATIVO",
    activationSent: true,
    ...overrides,
  };
}

export function makeRpvValidation(
  overrides: Partial<RpvValidation> = {},
): RpvValidation {
  return {
    formacaoId: "for-1",
    alunoId: "alu-1",
    alunoNome: "Ana Lima",
    alunoSlug: "ana-lima",
    alunoAtivo: true,
    tipo: "TECNICO",
    nome: "Técnico em Informática",
    instituicao: "Rio Pomba Valley",
    dataInicio: "2024-02-01",
    dataFim: null,
    cargaHoraria: 800,
    status: "EM_ANDAMENTO",
    principal: true,
    possuiCertificado: true,
    atualizadoEm: "2026-09-01T12:00:00Z",
    ...overrides,
  };
}

type RpvFormacaoOverrides = Partial<RpvValidationDetail["formacao"]>;
type RpvAlunoOverrides = Partial<RpvValidationDetail["aluno"]>;

export function makeRpvValidationDetail(
  overrides: {
    formacaoId?: string;
    aluno?: RpvAlunoOverrides;
    formacao?: RpvFormacaoOverrides;
  } = {},
): RpvValidationDetail {
  return {
    formacaoId: overrides.formacaoId ?? "for-1",
    aluno: {
      id: "alu-1",
      nomeCompleto: "Ana Lima",
      slug: "ana-lima",
      ativo: true,
      cidade: "Rio Pomba",
      uf: "MG",
      ...overrides.aluno,
    },
    formacao: {
      tipo: "TECNICO",
      nome: "Técnico em Informática",
      instituicao: "Rio Pomba Valley",
      dataInicio: "2024-02-01",
      dataFim: "2025-12-15",
      cargaHoraria: 800,
      status: "CONCLUIDO",
      principal: true,
      possuiCertificado: true,
      atualizadoEm: "2026-09-01T12:00:00Z",
      ehRioPombaValley: true,
      statusValidacaoRpv: "PENDENTE",
      ...overrides.formacao,
    },
  };
}

export function makeAuditItem(overrides: Partial<AuditItem> = {}): AuditItem {
  return {
    id: "aud-1",
    acao: "BLOQUEAR_RECRUTADOR",
    adminEmail: "admin@riopombavalley.com.br",
    entidadeTipo: "Recrutador",
    entidadeId: "rec-1",
    descricao: "Recrutador bloqueado pelo administrador.",
    criadoEm: "2026-09-01T12:00:00Z",
    ...overrides,
  };
}
