"use client";

import { Avatar, CircularProgress, Box } from "@mui/material";
import { useProtectedFile } from "@/hooks/useProtectedFile";
import { initialsOf } from "@/lib/format";

interface ProtectedTalentPhotoProps {
  path: string | null;
  name: string;
  size?: number;
}

export function ProtectedTalentPhoto({ path, name, size = 72 }: ProtectedTalentPhotoProps) {
  const { url, loading } = useProtectedFile(path);
  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <Avatar src={url ?? undefined} alt={url ? `Foto de ${name}` : undefined}
        sx={{ width: size, height: size, fontSize: size / 3, fontWeight: 700 }}>
        {initialsOf(name)}
      </Avatar>
      {loading && <CircularProgress size={Math.min(32, size / 2)} sx={{ position: "absolute", inset: 0, m: "auto" }} />}
    </Box>
  );
}
