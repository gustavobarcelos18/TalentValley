"use client";

import { Avatar } from "@mui/material";
import { useProtectedFile } from "@/hooks/useProtectedFile";
import { initialsOf } from "@/lib/format";

interface UserAvatarProps {
  name: string;
  /** Protected API path (ex: /api/alunos/me/foto). Null = fallback com iniciais. */
  photoPath?: string | null;
  size?: number;
}

// Header avatar: mostra a foto protegida quando existe, senão mantém o
// fallback atual com as iniciais do nome. Nunca quebra sem foto.
export function UserAvatar({ name, photoPath = null, size = 32 }: UserAvatarProps) {
  const { url } = useProtectedFile(photoPath);
  return (
    <Avatar
      src={url ?? undefined}
      alt={url ? `Foto de ${name}` : undefined}
      sx={{ width: size, height: size, bgcolor: "primary.main", fontWeight: 600 }}
    >
      {initialsOf(name)}
    </Avatar>
  );
}
