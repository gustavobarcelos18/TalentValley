"use client";

import { useCallback, useEffect, useState } from "react";
import { getApiErrorMessage } from "@/lib/api";
import { fetchMyProfile } from "@/lib/student";
import type { MeResponse } from "@/types/student";

interface StudentProfileState {
  profile: MeResponse | null;
  loading: boolean;
  error: string | null;
}

// Loads and refreshes the authenticated student profile (GET /api/alunos/me).
// Sections call `refresh` after a successful mutation so the page always shows
// backend state.
export function useStudentProfile() {
  const [state, setState] = useState<StudentProfileState>({
    profile: null,
    loading: true,
    error: null,
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const profile = await fetchMyProfile();
      setState({ profile, loading: false, error: null });
    } catch (error) {
      setState({
        profile: null,
        loading: false,
        error: getApiErrorMessage(
          error,
          "Não foi possível carregar seu perfil. Tente novamente."
        ),
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    try {
      const profile = await fetchMyProfile();
      setState({ profile, loading: false, error: null });
    } catch (error) {
      // Keep the last known profile on refresh failures; the user still sees
      // their data and can retry the edit.
      setState((prev) => ({
        ...prev,
        error: getApiErrorMessage(
          error,
          "Não foi possível atualizar o perfil. Tente novamente."
        ),
      }));
    }
  }, []);

  return { ...state, refresh };
}
