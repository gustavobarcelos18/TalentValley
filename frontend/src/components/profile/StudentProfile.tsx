"use client";

import { useCallback, useState, type ComponentType } from "react";
import {
  Alert,
  Box,
  Button,
  Container,
  Snackbar,
  Stack,
  Typography,
} from "@mui/material";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { CONTENT_MAX_WIDTH } from "@/components/layout/contentWidth";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { CompetenciasSection } from "./CompetenciasSection";
import { ContatoSection } from "./ContatoSection";
import { DisponibilidadeSection } from "./DisponibilidadeSection";
import { CurriculoSection } from "./CurriculoSection";
import { IdiomasSection } from "./IdiomasSection";
import { ProfileHeader } from "./ProfileHeader";
import { SECTION_SCROLL_MARGIN, ProfileIndex } from "./ProfileIndex";
import { PROFILE_BLOCKS, profileSectionAnchor, type ProfileSectionId } from "./profileSections";
import type { SectionProps } from "./sectionProps";
import { SobreSection } from "./SobreSection";
import { TrajetoriaSection } from "./TrajetoriaSection";
import { ProjetosSection } from "./ProjetosSection";
import { ExclusaoSection } from "./ExclusaoSection";
import { PrivacidadeSection } from "@/components/account/PrivacidadeSection";
import { fetchMyDataExport, fetchMyNewsletter, saveMyNewsletter } from "@/lib/student";

const SECTION_COMPONENTS: Record<ProfileSectionId, ComponentType<SectionProps>> = {
  sobre: SobreSection,
  contato: ContatoSection,
  trajetoria: TrajetoriaSection,
  competencias: CompetenciasSection,
  idiomas: IdiomasSection,
  busca: DisponibilidadeSection,
  projetos: ProjetosSection,
  curriculo: CurriculoSection,
};

// Real student profile page: header, then the sections in three blocks with an index to jump between them.
export function StudentProfile() {
  const { profile, loading, error, refresh } = useStudentProfile();
  const [message, setMessage] = useState<string | null>(null);

  const notify = useCallback((text: string) => setMessage(text), []);
  const closeMessage = useCallback((_event?: unknown, reason?: string) => {
    if (reason === "clickaway") return;
    setMessage(null);
  }, []);

  return (
    <Container maxWidth={false} sx={{ maxWidth: CONTENT_MAX_WIDTH, py: { xs: 3, md: 4 }, width: "100%" }}>
      {loading && <LoadingSkeleton count={4} height={150} />}

      {!loading && error && !profile && (
        <Stack spacing={2} sx={{ alignItems: "center", py: 8 }}>
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
          <Box
            sx={{
              // Below xl the index is a bar that must stick over the whole page, so it needs a plain block, not a grid row.
              display: { xs: "block", xl: "grid" },
              gridTemplateColumns: { xl: "200px minmax(0, 1fr)" },
              columnGap: 4,
            }}
          >
            <ProfileIndex />
            <Stack spacing={{ xs: 3, sm: 4 }}>
              {PROFILE_BLOCKS.map((block) => (
                <Stack key={block.title} role="group" aria-label={block.title} spacing={{ xs: 2.5, sm: 3 }}>
                  <Typography component="p" variant="overline" color="text.secondary" aria-hidden sx={{ lineHeight: 1.6 }}>
                    {block.title}
                  </Typography>
                  {block.sections.map((section) => {
                    const Section = SECTION_COMPONENTS[section.id];
                    return (
                      <Box key={section.id} id={profileSectionAnchor(section.id)} sx={{ scrollMarginTop: SECTION_SCROLL_MARGIN }}>
                        <Section profile={profile} onChanged={refresh} notify={notify} />
                      </Box>
                    );
                  })}
                </Stack>
              ))}
            </Stack>
          </Box>
          <PrivacidadeSection
            fetchData={fetchMyDataExport}
            fetchNewsletter={fetchMyNewsletter}
            saveNewsletter={saveMyNewsletter}
          />
          <ExclusaoSection />
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
