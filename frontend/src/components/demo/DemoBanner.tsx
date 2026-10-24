"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Typography } from "@mui/material";
import { useAuth } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/labels";
import { leaveDemo } from "@/lib/auth";
import { DEMO_BANNER_HEIGHT_VAR } from "./bannerHeight";

/** Fixed notice shown on every screen while the administrator views the site as a demonstration account. */
export function DemoBanner() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const banner = useRef<HTMLDivElement>(null);
  const active = Boolean(user?.modoDemonstracao);

  // The notice changes height with the screen width and with an error message, so it is measured.
  useEffect(() => {
    const element = banner.current;
    if (!active || !element) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty(DEMO_BANNER_HEIGHT_VAR, `${element.offsetHeight}px`);
    publish();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(publish);
    observer?.observe(element);
    return () => {
      observer?.disconnect();
      root.style.removeProperty(DEMO_BANNER_HEIGHT_VAR);
    };
  }, [active]);

  if (!active || !user) return null;

  async function handleLeave() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await leaveDemo();
      // A full page load reads the new session again. A client-side switch would show "access denied"
      // for a moment, because the screen of the old role is still open while the user is already the new one.
      window.location.assign(response.destinoInicial);
    } catch {
      // The server answers 403 when the way back is no longer valid; its text is not meant for the screen.
      setError("Não foi possível voltar ao Admin. Tente novamente ou saia e entre como Admin.");
      setBusy(false);
    }
  }

  return (
    <Alert
      ref={banner}
      role="region"
      aria-label="Modo demonstração"
      severity="warning"
      icon={false}
      sx={{ borderRadius: 0, py: 0.5, flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" } }}
      // On a phone the button goes under the text, so the fixed notice stays short.
      slotProps={{ action: { sx: { ml: { xs: 0, sm: "auto" }, pl: { xs: 0, sm: 2 }, mr: 0 } } }}
      action={
        <Button color="inherit" size="small" variant="outlined" onClick={handleLeave} disabled={busy}>
          {busy ? "Voltando..." : "Voltar ao Admin"}
        </Button>
      }
    >
      Modo demonstração: você está vendo como {ROLE_LABELS[user.role]}. Dados fictícios.
      {error && (
        <Typography role="alert" variant="body2" sx={{ fontWeight: 600 }}>
          {error}
        </Typography>
      )}
    </Alert>
  );
}
