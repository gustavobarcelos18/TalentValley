"use client";

import { Container, Stack } from "@mui/material";
import { PrivacidadeSection } from "@/components/account/PrivacidadeSection";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PageHeader } from "@/components/common/PageHeader";
import { CONTENT_MAX_WIDTH } from "@/components/layout/contentWidth";
import { fetchMyDataExport, fetchMyNewsletter, saveMyNewsletter } from "@/lib/recruiter";

// Students reach the same section inside "Meu perfil"; recruiters have no profile page, so it lives here.
export default function PrivacyPage() {
  return (
    <ProtectedRoute allowedRoles={["RECRUTADOR"]}>
      <Container maxWidth={false} sx={{ maxWidth: CONTENT_MAX_WIDTH, py: 4 }}>
        <Stack spacing={3}>
          <PageHeader title="Minha conta" description="Veja e baixe os dados pessoais que a plataforma guarda sobre você." />
          <PrivacidadeSection
            fetchData={fetchMyDataExport}
            fetchNewsletter={fetchMyNewsletter}
            saveNewsletter={saveMyNewsletter}
          />
        </Stack>
      </Container>
    </ProtectedRoute>
  );
}
