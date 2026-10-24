"use client";

import { useState } from "react";
import { Alert, Button, Chip, Stack, Typography } from "@mui/material";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { Confirm } from "@/components/admin/adminShared";
import { useLoad } from "@/components/admin/useLoad";
import { adminApi } from "@/lib/admin";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import { enterDemo, type DemoRole } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";

type Busy = "preparar" | "restaurar" | DemoRole | null;

const DEMO_ROLES: DemoRole[] = ["ALUNO", "RECRUTADOR"];

const countOf = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`;

// The server writes the 409 text in Portuguese; the other answers are not meant for the screen.
function failureMessage(reason: unknown, fallback: string): string {
  return reason instanceof ApiError && reason.status === 409 ? getApiErrorMessage(reason, fallback) : fallback;
}

/**
 * Demonstration tools of the administrator: prepare or restore the fictitious accounts and view the
 * site as one of them. With demonstration mode off on the server the card is not rendered at all.
 */
export function AdminDemoCard({ index = 0 }: { index?: number }) {
  const state = useLoad(() => adminApi.demoState(), []);
  const [busy, setBusy] = useState<Busy>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [message, setMessage] = useState<{ severity: "success" | "error"; text: string } | null>(null);

  if (!state.data?.habilitado) return null;
  const prepared = state.data.preparado;

  async function change(action: "preparar" | "restaurar") {
    setBusy(action);
    setMessage(null);
    try {
      const result = await (action === "preparar" ? adminApi.prepareDemo() : adminApi.restoreDemo());
      const done = action === "preparar" ? "Demonstração preparada" : "Demonstração restaurada";
      setMessage({
        severity: "success",
        text: `${done}: ${countOf(result.alunosCriados, "aluno", "alunos")} e ${countOf(result.recrutadoresCriados, "recrutador", "recrutadores")} fictícios criados agora.`,
      });
      state.reload();
    } catch (reason) {
      setMessage({
        severity: "error",
        text: failureMessage(reason, "Não foi possível concluir a operação. Tente novamente."),
      });
    } finally {
      setConfirmRestore(false);
      setBusy(null);
    }
  }

  async function viewAs(papel: DemoRole) {
    setBusy(papel);
    setMessage(null);
    try {
      const response = await enterDemo(papel);
      // A full page load reads the new session again. A client-side switch would show "access denied"
      // for a moment, because the admin screen is still open while the user is already the demo account.
      window.location.assign(response.destinoInicial);
    } catch (reason) {
      setMessage({
        severity: "error",
        text: failureMessage(reason, "Não foi possível entrar na demonstração. Tente novamente."),
      });
      setBusy(null);
    }
  }

  return (
    <>
      <SurfaceCard
        title="Demonstração"
        index={index}
        action={<Chip size="small" color={prepared ? "success" : "default"} label={prepared ? "Preparada" : "Não preparada"} />}
      >
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Veja o site como um aluno ou um recrutador fictício, sem expor dados reais. Você pode agir normalmente nessas
            contas; &quot;Restaurar&quot; desfaz tudo e recria apenas os dados de demonstração.
          </Typography>
          {message && (
            <Alert severity={message.severity} role={message.severity === "error" ? "alert" : "status"}>
              {message.text}
            </Alert>
          )}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap sx={{ flexWrap: "wrap" }}>
            {prepared ? (
              <>
                {DEMO_ROLES.map((papel) => (
                  <Button key={papel} variant="contained" onClick={() => viewAs(papel)} disabled={busy !== null}>
                    {busy === papel ? "Entrando..." : `Ver como ${ROLE_LABELS[papel]}`}
                  </Button>
                ))}
                <Button variant="outlined" onClick={() => setConfirmRestore(true)} disabled={busy !== null}>
                  Restaurar demonstração
                </Button>
              </>
            ) : (
              <Button variant="contained" onClick={() => change("preparar")} disabled={busy !== null}>
                {busy === "preparar" ? "Preparando..." : "Preparar demonstração"}
              </Button>
            )}
          </Stack>
        </Stack>
      </SurfaceCard>
      <Confirm
        open={confirmRestore}
        title="Restaurar demonstração?"
        text="Os dados das contas fictícias serão apagados e recriados do zero. Contas reais não são afetadas."
        confirm={() => change("restaurar")}
        busy={busy === "restaurar"}
        onClose={() => setConfirmRestore(false)}
      />
    </>
  );
}
