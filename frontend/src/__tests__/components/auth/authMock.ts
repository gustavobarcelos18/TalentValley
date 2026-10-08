import { vi } from "vitest";
import type { UserRole, UsuarioAutenticado } from "@/types/auth";

export interface AuthMock {
  user: UsuarioAutenticado | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

export function userWith(role: UserRole): UsuarioAutenticado {
  return { id: "1", nome: "Ana", email: "ana@example.com", role };
}

export function buildAuth(partial: Partial<AuthMock>): AuthMock {
  return { user: null, loading: false, error: null, refreshUser: vi.fn().mockResolvedValue(undefined), ...partial };
}
