"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";
import { fetchMyProfile } from "@/lib/student";
import { subscribePhotoChange } from "@/lib/photoSync";

// Retorna o caminho protegido da foto do aluno logado (/api/alunos/me/foto)
// ou null. Outras roles não têm foto própria: retorna null sem request
// (GET /api/alunos/me daria 403 para recrutador/admin).
export function useMyPhoto() {
  const { user } = useAuth();
  const isStudent = user?.role === "ALUNO";
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  // Reset any previously-loaded photo during render as soon as the
  // authenticated student changes, so another user's photo is never shown
  // while the new profile request is still pending.
  const userId = user?.id ?? null;
  const [prevUserId, setPrevUserId] = useState(userId);
  if (userId !== prevUserId) {
    setPrevUserId(userId);
    setPhotoPath(null);
  }

  useEffect(() => {
    if (!isStudent) return;
    let active = true;
    const load = () => {
      const requestId = ++requestIdRef.current;
      fetchMyProfile()
        .then((profile) => {
          if (active && requestId === requestIdRef.current)
            setPhotoPath(profile.dadosBasicos.fotoUrl);
        })
        .catch(() => {
          // Sem foto ou falha de rede: header mantém o fallback com iniciais.
          if (active && requestId === requestIdRef.current) setPhotoPath(null);
        });
    };
    load();
    // After a successful photo upload/removal elsewhere, re-read the profile
    // and force mounted avatars to reload the protected bytes, even when the
    // photo path stays the same protected endpoint.
    const unsubscribe = subscribePhotoChange(() => {
      setReloadKey((key) => key + 1);
      load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [isStudent, user?.id]);

  return {
    photoPath: isStudent ? photoPath : null,
    reloadKey: isStudent ? reloadKey : 0,
  };
}
