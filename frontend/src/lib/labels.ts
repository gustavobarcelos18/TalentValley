import type { UserRole } from "@/types/auth";
import type {
  ModalidadeTrabalho,
  NivelIdioma,
  TipoDisponibilidade,
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

export const NIVEL_IDIOMA_LABELS: Record<NivelIdioma, string> = {
  BASICO: "Básico",
  INTERMEDIARIO: "Intermediário",
  AVANCADO: "Avançado",
  FLUENTE: "Fluente",
  NATIVO: "Nativo",
};

export const DISPONIBILIDADE_OPCOES = Object.keys(DISPONIBILIDADE_LABELS) as TipoDisponibilidade[];

export const MODALIDADE_OPCOES = Object.keys(MODALIDADE_LABELS) as ModalidadeTrabalho[];

export const NIVEL_IDIOMA_OPCOES = Object.keys(NIVEL_IDIOMA_LABELS) as NivelIdioma[];
