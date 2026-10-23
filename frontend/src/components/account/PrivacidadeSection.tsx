"use client";

import { useId, useState } from "react";
import { Alert, Box, Button, Card, CircularProgress, Stack, Typography } from "@mui/material";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import { Reveal } from "@/components/common/Reveal";
import { getApiErrorMessage } from "@/lib/api";
import type { NewsletterResponse } from "@/types";
import { NewsletterToggle } from "./NewsletterToggle";

const FILE_NAME_PREFIX = "talent-valley-meus-dados";

interface PrivacidadeSectionProps {
  // Loads the signed-in person's own data; the backend derives who it is from the session.
  fetchData: () => Promise<unknown>;
  fetchNewsletter: () => Promise<NewsletterResponse>;
  saveNewsletter: (aceita: boolean) => Promise<NewsletterResponse>;
}

function saveJsonFile(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next tick so the browser can start the download first.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// LGPD rights in one place: newsletter consent (give/withdraw) and a copy of the person's own data as JSON.
export function PrivacidadeSection({ fetchData, fetchNewsletter, saveNewsletter }: PrivacidadeSectionProps) {
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function download() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const data = await fetchData();
      saveJsonFile(data, `${FILE_NAME_PREFIX}-${new Date().toISOString().slice(0, 10)}.json`);
      setDone(true);
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Não foi possível baixar seus dados. Tente novamente."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Reveal>
      <Card component="section" aria-labelledby={titleId} sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <ShieldOutlined color="primary" aria-hidden="true" />
            <Typography id={titleId} component="h2" variant="h6">
              Privacidade
            </Typography>
          </Stack>
          <NewsletterToggle fetchNewsletter={fetchNewsletter} saveNewsletter={saveNewsletter} />
          <Typography variant="body2" color="text.secondary">
            Baixe uma cópia dos seus dados pessoais em um arquivo JSON. Fotos, currículos e
            certificados não vão no arquivo: ele informa apenas se você os enviou.
          </Typography>
          {error && (
            <Alert severity="error" role="alert">
              {error}
            </Alert>
          )}
          {done && (
            <Alert severity="success" role="status">
              Seus dados foram baixados.
            </Alert>
          )}
          <Box>
            <Button
              variant="outlined"
              onClick={download}
              disabled={busy}
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <FileDownloadOutlined />}
            >
              {busy ? "Preparando..." : "Baixar meus dados"}
            </Button>
          </Box>
        </Stack>
      </Card>
    </Reveal>
  );
}
