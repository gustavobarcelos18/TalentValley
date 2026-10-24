import { disponivelAgora } from "@/lib/busca";
import { DISPONIBILIDADE_LABELS, MODALIDADE_LABELS, STATUS_BUSCA_LABELS, TIPO_DEFICIENCIA_LABELS } from "@/lib/labels";
import type { TalentBusca, TalentPcd } from "@/types/recruiter";
import type { ModalidadeTrabalho, StatusBusca, TipoDisponibilidade } from "@/types/student";

// Presentation rules for "O que eu busco" on the recruiter and admin screens.

export const AVISO_PCD =
  "Informação compartilhada pelo aluno com consentimento. Use-a somente para encontrar e contatar alunos.";
export const INFORMADO_PELO_ALUNO = "informado pelo aluno";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "2027-01-15" becomes "jan/2027". */
export function mesAno(iso: string): string {
  const [ano, mes] = iso.slice(0, 10).split("-");
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

/** When the student can start: "início imediato" (a past date counts as immediate), "a partir de jan/2027" or null. */
export function inicioBusca(busca: TalentBusca, agora: Date = new Date()): string | null {
  if (disponivelAgora(busca, agora)) return "início imediato";
  return busca.disponivelAPartirDe ? `a partir de ${mesAno(busca.disponivelAPartirDe)}` : null;
}

/** "Estágio · Híbrido · a partir de jan/2027", or an empty string when nothing was informed. */
export function linhaBusca(
  disponibilidades: readonly TipoDisponibilidade[],
  modalidades: readonly ModalidadeTrabalho[],
  busca: TalentBusca,
  agora: Date = new Date(),
): string {
  return [
    ...disponibilidades.map((item) => DISPONIBILIDADE_LABELS[item]),
    ...modalidades.map((item) => MODALIDADE_LABELS[item]),
    inicioBusca(busca, agora),
  ]
    .filter((item) => item !== null)
    .join(" · ");
}

// Status as the recruiter reads it (the student's own wording is in STATUS_BUSCA_LABELS).
export const STATUS_BUSCA_RECRUTADOR_LABELS: Record<StatusBusca, string> = {
  ...STATUS_BUSCA_LABELS,
  NAO_BUSCANDO: "Não está buscando agora",
};

/** Warning the recruiter must see next to the status (the "not looking now" status is shown by the status chip itself), or null. */
export function avisoStatusDesatualizado(busca: TalentBusca): string | null {
  return busca.statusDesatualizado ? "Status não confirmado há mais de 30 dias" : null;
}

/** "CNH B · veículo próprio" (declared by the student), or an empty list when nothing was informed. */
export function habilitacaoBusca(busca: TalentBusca): string[] {
  return [
    busca.categoriasCnh.length > 0 ? `CNH ${busca.categoriasCnh.join(", ")}` : null,
    busca.possuiVeiculoProprio ? "veículo próprio" : null,
  ].filter((item) => item !== null);
}

function minuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

/** Neutral PCD labels; empty when the student gave no consent (pcd is null) or answered no to everything. */
export function etiquetasPcd(pcd: TalentPcd | null): string[] {
  if (!pcd) return [];
  return [
    pcd.souPcd ? ["Pessoa com deficiência", ...pcd.tipos.map((tipo) => minuscula(TIPO_DEFICIENCIA_LABELS[tipo]))].join(" · ") : null,
    pcd.interesseVagaPcd ? "Interesse em vaga PCD" : null,
  ].filter((item) => item !== null);
}
