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
import { useRouter } from "next/navigation";
import { ApiError, refreshCsrfToken, setUnauthorizedHandler } from "@/lib/api";
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

  const router = useRouter();
  const initialCheckDone = useRef(false);
  const userRef = useRef<UsuarioAutenticado | null>(null);

  useEffect(() => {
    userRef.current = state.user;
  }, [state.user]);

  // A 401 for a signed-in user means the session is gone (expired, or ended
  // by a password change elsewhere). End the local login once and send the
  // user to the login screen with a notice. Anonymous 401s (wrong credentials,
  // the first /me check) are not session expiry and are left to each screen.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!userRef.current) return;
      userRef.current = null;
      setState({ user: null, loading: false, error: null });
      void refreshCsrfToken();
      router.replace("/login?sessao=expirada");
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

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
