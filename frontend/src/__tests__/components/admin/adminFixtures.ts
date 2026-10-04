import type {
  AdminDashboard,
  AdminStudentCreated,
  AdminStudentListItem,
  PaginatedResponse,
} from "@/types/admin";

const DEFAULT_PAGE_SIZE = 10;

/** Dashboard with every counter filled; pass `overrides` for the fields a test cares about. */
export function makeAdminDashboard(overrides: Partial<AdminDashboard> = {}): AdminDashboard {
  return {
    alunosAtivos: 42,
    recrutadoresAtivos: 7,
    solicitacoesCadastroPendentes: 3,
    validacoesRpvPendentes: 5,
    perfisAtualizadosUltimos7Dias: 18,
    formacoesRpvVerificadas: 11,
    competenciasMaisUtilizadas: [
      { id: 1, nome: "React", quantidadeAlunos: 20 },
      { id: 2, nome: "TypeScript", quantidadeAlunos: 15 },
    ],
    ...overrides,
  };
}

/** Active student with a location; pass `overrides` for the fields a test cares about. */
export function makeStudentListItem(overrides: Partial<AdminStudentListItem> = {}): AdminStudentListItem {
  return {
    id: "aluno-1",
    slug: "ana-lima",
    nomeCompleto: "Ana Lima",
    fotoUrl: null,
    cidade: "Rio Pomba",
    uf: "MG",
    ativo: true,
    atualizadoEm: "2026-09-01T12:00:00Z",
    ...overrides,
  };
}

export function makeStudentCreated(overrides: Partial<AdminStudentCreated> = {}): AdminStudentCreated {
  return {
    id: "aluno-novo",
    nomeCompleto: "Novo Aluno",
    email: "novo@example.com",
    ativo: true,
    activationSent: true,
    ...overrides,
  };
}

/** Wraps items in the paginated envelope the admin API returns. */
export function makePaginated<T>(items: T[], page = 1, totalPages = 1): PaginatedResponse<T> {
  return { items, page, pageSize: DEFAULT_PAGE_SIZE, totalItems: items.length, totalPages };
}

export interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

/** A promise settled by the test, to observe in-flight (loading/stale) states. */
export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
