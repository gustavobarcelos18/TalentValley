import { TIPO_DEFICIENCIA_LABELS } from "@/lib/labels";
import type { BuscaResponse, ModalidadeTrabalho, TipoDisponibilidade } from "@/types/student";

// Presentation rules for "O que eu busco". The backend decides when the status is outdated
// (statusDesatualizado); the dates here only drive the early warning shown before that.

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_VALIDADE_DIAS = 30;
export const STATUS_AVISO_ANTECEDENCIA_DIAS = 7;

const CONFIRME_PARA_NAO_VENCER = "Confirme para ela não aparecer como desatualizada.";

/** Days left before the confirmed status counts as outdated, or null when it was never confirmed. */
export function diasParaStatusVencer(statusConfirmadoEm: string | null, agora: Date = new Date()): number | null {
  if (!statusConfirmadoEm) return null;
  const vence = new Date(statusConfirmadoEm).getTime() + STATUS_VALIDADE_DIAS * DAY_MS;
  return Math.max(0, Math.ceil((vence - agora.getTime()) / DAY_MS));
}

/** Warning about the search status (outdated, or about to be), or null when there is nothing to warn. */
export function avisoStatusBusca(busca: BuscaResponse, agora: Date = new Date()): string | null {
  if (busca.status === null) return null;
  if (busca.statusDesatualizado) {
    return "Sua situação de busca está sem confirmação há mais de 30 dias. Recrutadores veem o aviso de que ela pode estar desatualizada.";
  }
  const dias = diasParaStatusVencer(busca.statusConfirmadoEm, agora);
  if (dias === null || dias > STATUS_AVISO_ANTECEDENCIA_DIAS) return null;
  if (dias === 0) return `Sua situação de busca vence hoje. ${CONFIRME_PARA_NAO_VENCER}`;
  return `Sua situação de busca vence em ${dias === 1 ? "1 dia" : `${dias} dias`}. ${CONFIRME_PARA_NAO_VENCER}`;
}

/** Today as yyyy-MM-dd in the local time zone, the same shape as the API date-only values. */
export function hojeIso(agora: Date = new Date()): string {
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

/** A start date that is today or already past means the student is available now. */
export function disponivelAgora(
  busca: Pick<BuscaResponse, "disponivelImediatamente" | "disponivelAPartirDe">,
  agora: Date = new Date(),
): boolean {
  return busca.disponivelImediatamente || (busca.disponivelAPartirDe !== null && busca.disponivelAPartirDe <= hojeIso(agora));
}

/** Mobility answers that are "yes"; the backend cannot tell "no" from "not informed". */
export function resumoMobilidade(busca: Pick<BuscaResponse, "aceitaViajar" | "aceitaMudarDeCidade">): string[] {
  return [
    busca.aceitaViajar ? "Aceita viajar a trabalho" : null,
    busca.aceitaMudarDeCidade ? "Aceita mudar de cidade" : null,
  ].filter((item) => item !== null);
}

export function resumoHabilitacao(busca: Pick<BuscaResponse, "categoriasCnh" | "possuiVeiculoProprio">): string[] {
  return [
    busca.categoriasCnh.length > 0 ? `CNH ${busca.categoriasCnh.join(", ")}` : null,
    busca.possuiVeiculoProprio ? "Veículo próprio" : null,
  ].filter((item) => item !== null);
}

export function resumoPcd(busca: BuscaResponse): string[] {
  const { souPcd, interesseVagaPcd, tipos } = busca.pcd;
  return [
    souPcd ? ["Pessoa com deficiência", ...tipos.map((tipo) => TIPO_DEFICIENCIA_LABELS[tipo])].join(" · ") : null,
    interesseVagaPcd ? "Interesse em vagas para PCD" : null,
  ].filter((item) => item !== null);
}

export function buscaEstaVazia(
  busca: BuscaResponse,
  disponibilidades: readonly TipoDisponibilidade[],
  modalidades: readonly ModalidadeTrabalho[],
): boolean {
  return (
    disponibilidades.length === 0 &&
    modalidades.length === 0 &&
    busca.status === null &&
    !busca.objetivo &&
    busca.areasInteresse.length === 0 &&
    !busca.disponivelImediatamente &&
    busca.disponivelAPartirDe === null &&
    busca.cargaHoraria === null &&
    resumoMobilidade(busca).length === 0 &&
    resumoHabilitacao(busca).length === 0 &&
    resumoPcd(busca).length === 0
  );
}
