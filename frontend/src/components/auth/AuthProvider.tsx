"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ApiError } from "@/lib/api";
import { fetchCurrentUser, logout as apiLogout } from "@/lib/auth";
import type { UsuarioAutenticado } from "@/types/auth";

interface AuthState {
  user: UsuarioAutenticado | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  loginCompleted: (user: UsuarioAutenticado) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });

  const initialCheckDone = useRef(false);

  const refreshUser = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      setState({ user, loading: false, error: null });
    } catch (error) {
      // 401/403 mean the current session is not usable: treat it as normal
      // anonymous behavior. Any other failure (network, 5xx, ...) is an
      // operational error and must never be mistaken for a logout.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setState({ user: null, loading: false, error: null });
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Não foi possível verificar sua sessão. Tente novamente.",
        }));
      }
    }
  }, []);

  useEffect(() => {
    if (initialCheckDone.current) return;
    initialCheckDone.current = true;

    refreshUser();
  }, [refreshUser]);

  const loginCompleted = useCallback((user: UsuarioAutenticado) => {
    setState({ user, loading: false, error: null });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      loginCompleted,
      logout,
      refreshUser,
      clearError,
    }),
    [state, loginCompleted, logout, refreshUser, clearError]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
