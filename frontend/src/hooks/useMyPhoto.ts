"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { fetchMyProfile } from "@/lib/student";

// Retorna o caminho protegido da foto do aluno logado (/api/alunos/me/foto)
// ou null. Outras roles não têm foto própria: retorna null sem request
// (GET /api/alunos/me daria 403 para recrutador/admin).
export function useMyPhoto() {
  const { user } = useAuth();
  const isStudent = user?.role === "ALUNO";
  const [photoPath, setPhotoPath] = useState<string | null>(null);

  useEffect(() => {
    if (!isStudent) return;
    let active = true;
    fetchMyProfile()
      .then((profile) => {
        if (active) setPhotoPath(profile.dadosBasicos.fotoUrl);
      })
      .catch(() => {
        // Sem foto ou falha de rede: header mantém o fallback com iniciais.
        if (active) setPhotoPath(null);
      });
    return () => {
      active = false;
    };
  }, [isStudent, user?.id]);

  return { photoPath: isStudent ? photoPath : null };
}
