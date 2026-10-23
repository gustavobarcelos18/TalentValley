"use client";

import { useEffect, useId, useState } from "react";
import { Alert, FormControlLabel, Stack, Switch, Typography } from "@mui/material";
import { getApiErrorMessage } from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";
import type { NewsletterResponse } from "@/types";

interface NewsletterToggleProps {
  // Both functions act on the signed-in person only; the backend derives who it is from the session.
  fetchNewsletter: () => Promise<NewsletterResponse>;
  saveNewsletter: (aceita: boolean) => Promise<NewsletterResponse>;
}

function describe(state: NewsletterResponse): string {
  if (!state.atualizadaEm) return "Você ainda não aceitou receber novidades por e-mail.";
  const when = formatUpdatedAt(state.atualizadaEm);
  return state.aceita
    ? `Você aceitou receber novidades em ${when}.`
    : `Você deixou de receber novidades em ${when}.`;
}

// LGPD: the person can give or withdraw the newsletter consent at any time.
export function NewsletterToggle({ fetchNewsletter, saveNewsletter }: NewsletterToggleProps) {
  const descriptionId = useId();
  const [state, setState] = useState<NewsletterResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchNewsletter()
      .then((loaded) => {
        if (active) setState(loaded);
      })
      .catch((reason) => {
        if (active) setError(getApiErrorMessage(reason, "Não foi possível carregar sua preferência de e-mails."));
      });
    return () => {
      active = false;
    };
  }, [fetchNewsletter]);

  async function change(aceita: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setState(await saveNewsletter(aceita));
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Não foi possível salvar sua preferência. Tente novamente."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack spacing={1}>
      <FormControlLabel
        control={
          <Switch
            checked={state?.aceita ?? false}
            disabled={state === null || busy}
            onChange={(event) => void change(event.target.checked)}
            slotProps={{ input: { "aria-describedby": descriptionId } }}
          />
        }
        label="Receber novidades por e-mail"
      />
      {/* aria-live so screen readers announce the new state after a change. */}
      <Typography id={descriptionId} variant="body2" color="text.secondary" aria-live="polite">
        {state ? describe(state) : !error && "Carregando sua preferência..."}
      </Typography>
      {error && (
        <Alert severity="error" role="alert">
          {error}
        </Alert>
      )}
    </Stack>
  );
}
