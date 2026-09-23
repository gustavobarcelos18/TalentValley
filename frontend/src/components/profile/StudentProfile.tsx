"use client";

import { useCallback, useState } from "react";
import {
  Alert,
  Button,
  Container,
  CircularProgress,
  Snackbar,
  Stack,
} from "@mui/material";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { CompetenciasSection } from "./CompetenciasSection";
import { ContatoSection } from "./ContatoSection";
import { DadosBasicosSection } from "./DadosBasicosSection";
import { DisponibilidadeSection } from "./DisponibilidadeSection";
import { CurriculoSection } from "./CurriculoSection";
import { IdiomasSection } from "./IdiomasSection";
import { ProfileHeader } from "./ProfileHeader";
import { SobreSection } from "./SobreSection";
import { TrajetoriaSection } from "./TrajetoriaSection";
import { ProjetosSection } from "./ProjetosSection";

// Real student profile page content follows the approved professional profile order.
export function StudentProfile() {
  const { profile, loading, error, refresh } = useStudentProfile();
  const [message, setMessage] = useState<string | null>(null);

  const notify = useCallback((text: string) => setMessage(text), []);
  const closeMessage = useCallback(() => setMessage(null), []);

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, sm: 5 }, width: "100%" }}>
      {loading && (
                <Stack
          sx={{ alignItems: "center", justifyContent: "center", py: 10 }}
          role="status"
          aria-label="Carregando perfil"
        >
          <CircularProgress />
        </Stack>
      )}

      {!loading && error && !profile && (
        <Stack sx={{ alignItems: "center", py: 8 }}>
          <Alert severity="error" sx={{ width: "100%" }} role="alert">
            {error}
          </Alert>
          <Button variant="outlined" onClick={refresh}>
            Tentar novamente
          </Button>
        </Stack>
      )}

      {profile && (
        <Stack spacing={{ xs: 2.5, sm: 3 }}>
          {!loading && error && (
            <Alert
              severity="warning"
              role="alert"
              action={
                <Button color="inherit" size="small" onClick={refresh}>
                  Tentar novamente
                </Button>
              }
            >
              {error}
            </Alert>
          )}
          <ProfileHeader profile={profile} onChanged={refresh} notify={notify} />
          <DadosBasicosSection profile={profile} onChanged={refresh} notify={notify} />
          <SobreSection profile={profile} onChanged={refresh} notify={notify} />
          <ContatoSection profile={profile} onChanged={refresh} notify={notify} />
          <TrajetoriaSection profile={profile} onChanged={refresh} notify={notify} />
          <CompetenciasSection profile={profile} onChanged={refresh} notify={notify} />
          <IdiomasSection profile={profile} onChanged={refresh} notify={notify} />
          <DisponibilidadeSection profile={profile} onChanged={refresh} notify={notify} />
          <ProjetosSection profile={profile} onChanged={refresh} notify={notify} />
          <CurriculoSection profile={profile} onChanged={refresh} notify={notify} />
        </Stack>
      )}

      <Snackbar
        open={message !== null}
        autoHideDuration={3000}
        onClose={closeMessage}
        message={message ?? undefined}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Container>
  );
}
