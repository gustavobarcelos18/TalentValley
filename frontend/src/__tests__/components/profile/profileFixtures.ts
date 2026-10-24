import { vi } from "vitest";
import type { SectionProps } from "@/components/profile/sectionProps";
import type { BuscaResponse, MeResponse } from "@/types/student";

/** "O que eu busco" with nothing informed, as an existing student has before filling it. */
export function makeBusca(overrides: Partial<BuscaResponse> = {}): BuscaResponse {
  return {
    status: null,
    statusConfirmadoEm: null,
    statusDesatualizado: false,
    objetivo: null,
    areasInteresse: [],
    disponivelImediatamente: false,
    disponivelAPartirDe: null,
    cargaHoraria: null,
    aceitaViajar: false,
    aceitaMudarDeCidade: false,
    categoriasCnh: [],
    possuiVeiculoProprio: false,
    pcd: { souPcd: false, interesseVagaPcd: false, tipos: [], consentimentoEm: null },
    ...overrides,
  };
}

/** Fully populated profile; pass `overrides` for the fields a test cares about. */
export function makeProfile(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    id: "aluno-1",
    slug: "maria-souza",
    dadosBasicos: { nomeCompleto: "Maria Souza", fotoUrl: null, cidade: "Rio Pomba", uf: "MG" },
    sobre: { bio: "Estudante de sistemas de informação." },
    contato: {
      telefone: "32999998888",
      emailProfissional: "maria@example.com",
      linkedInUrl: "https://linkedin.com/in/maria",
      gitHubUrl: "https://github.com/maria",
      portfolioUrl: "https://maria.dev",
    },
    competencias: [{ id: 1, nome: "React", tipo: "TECNICA" }],
    idiomas: [{ idiomaId: 1, nome: "Inglês", nivel: "INTERMEDIARIO" }],
    disponibilidades: ["ESTAGIO"],
    modalidades: ["REMOTO"],
    busca: makeBusca(),
    formacoes: [],
    experiencias: [],
    projetos: [],
    curriculo: { possuiCurriculo: false, nomeArquivo: null },
    atualizadoEm: "2026-09-01T12:00:00Z",
    ...overrides,
  };
}

/** Props every section receives, with fresh `onChanged` / `notify` spies. */
export function makeSectionProps(overrides: Partial<MeResponse> = {}): SectionProps {
  return { profile: makeProfile(overrides), onChanged: vi.fn(), notify: vi.fn() };
}

/** Promise whose resolution is controlled by the test, to hold a request pending. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
