"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Box, Button, CircularProgress, Container, Paper, Stack, Typography } from "@mui/material";
import { PrivacidadeSection } from "@/components/account/PrivacidadeSection";
import { ConsentField } from "@/components/registration/ConsentField";
import { ExclusaoSection } from "@/components/profile/ExclusaoSection";
import { useAuth } from "@/hooks/useAuth";
import { getApiErrorMessage } from "@/lib/api";
import { acceptTerms } from "@/lib/auth";
import { getRoleDestination } from "@/lib/paths";
import * as recruiterApi from "@/lib/recruiter";
import * as studentApi from "@/lib/student";

// Shown to a student or recruiter whose stored acceptance is missing or is not the current terms version
// (accounts created by the admin, or after the terms changed). The server blocks everything else until
// the acceptance is recorded; the LGPD rights below stay available for people who do not want to accept.
export function AcceptTermsScreen() {
  const { user, error: sessionError, refreshUser, logout } = useAuth();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Once nothing is pending (accepted just now, or the person never needed to), go to their own area.
  useEffect(() => {
    if (user && !user.termosPendentes) router.replace(getRoleDestination(user.role));
  }, [user, router]);

  if (!user || !user.termosPendentes) return null;

  const isStudent = user.role === "ALUNO";
  const privacyApi = isStudent ? studentApi : recruiterApi;

  async function accept() {
    if (busy || !agreed) return;
    setBusy(true);
    setError(null);
    try {
      await acceptTerms();
      await refreshUser();
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Não foi possível registrar o aceite. Tente novamente."));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    await logout();
    router.replace("/login");
  }

  return (
    <Box component="main" className="min-h-screen px-4 py-12" sx={{ bgcolor: "background.default" }}>
      <Container maxWidth="sm">
        <Stack spacing={3}>
          <Paper variant="outlined" component="section" aria-labelledby="accept-terms-title" sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={2.5}>
              <Typography id="accept-terms-title" component="h1" variant="h5">
                Aceite os Termos de Uso e a Política de Privacidade
              </Typography>
              <Typography color="text.secondary">
                Para continuar usando a Talent Valley, leia e aceite a versão atual dos nossos Termos de Uso e da
                Política de Privacidade. Sem esse aceite, o acesso à plataforma fica bloqueado.
              </Typography>
              <ConsentField checked={agreed} error={null} disabled={busy} onChange={setAgreed} inputRef={() => undefined} />
              {(error ?? sessionError) && (
                <Alert severity="error" role="alert">
                  {error ?? sessionError}
                </Alert>
              )}
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                <Button
                  type="button"
                  variant="contained"
                  onClick={accept}
                  disabled={!agreed || busy}
                  startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
                >
                  {busy ? "Salvando..." : "Aceitar e continuar"}
                </Button>
                <Button type="button" variant="text" onClick={leave} disabled={busy}>
                  Sair
                </Button>
              </Stack>
            </Stack>
          </Paper>

          <Stack spacing={1.5} component="section" aria-labelledby="no-accept-title">
            <Typography id="no-accept-title" component="h2" variant="h6">
              Prefere não aceitar?
            </Typography>
            <Typography color="text.secondary">
              Você pode baixar uma cópia dos seus dados, desligar a newsletter
              {isStudent ? " ou excluir sua conta" : ""} antes de sair.
            </Typography>
            <PrivacidadeSection
              fetchData={privacyApi.fetchMyDataExport}
              fetchNewsletter={privacyApi.fetchMyNewsletter}
              saveNewsletter={privacyApi.saveMyNewsletter}
            />
            {isStudent && <ExclusaoSection />}
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
