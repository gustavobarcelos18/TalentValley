"use client";

import { useState } from "react";
import { Button, CircularProgress } from "@mui/material";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import { apiDownload, getApiErrorMessage } from "@/lib/api";

interface ProtectedFileButtonProps {
  path: string;
  label: string;
  onError?: (message: string) => void;
}

export function ProtectedFileButton({ path, label, onError }: ProtectedFileButtonProps) {
  const [loading, setLoading] = useState(false);

  async function openFile() {
    setLoading(true);
    try {
      const blob = await apiDownload(path);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      onError?.(getApiErrorMessage(error, "Não foi possível abrir o arquivo."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="small" variant="outlined" onClick={() => void openFile()} disabled={loading}
      startIcon={loading ? <CircularProgress size={16} /> : <OpenInNewOutlined />} aria-label={label}>
      {label}
    </Button>
  );
}
