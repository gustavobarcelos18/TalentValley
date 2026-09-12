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
    } catch {
      setState({ user: null, loading: false, error: null });
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
