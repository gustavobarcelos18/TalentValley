"use client";

import { useId } from "react";
import Link from "next/link";
import { Button, Card, Container, Stack, Typography } from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";
import { PrivacidadeSection } from "@/components/account/PrivacidadeSection";
import { PageHeader } from "@/components/common/PageHeader";
import { Reveal } from "@/components/common/Reveal";
import { CONTENT_MAX_WIDTH } from "@/components/layout/contentWidth";
import { CHANGE_PASSWORD_HREF } from "@/components/layout/navigation";
import { ExclusaoSection } from "@/components/profile/ExclusaoSection";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyDataExport, fetchMyNewsletter, saveMyNewsletter } from "@/lib/student";

function PasswordCard() {
  const titleId = useId();
  return (
    <Reveal>
      <Card component="section" aria-labelledby={titleId} sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <LockOutlined color="primary" aria-hidden="true" />
            <Typography id={titleId} component="h2" variant="h6">
              Senha
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Troque a senha de acesso à sua conta. Você precisará informar a senha atual.
          </Typography>
          <div>
            <Button component={Link} href={CHANGE_PASSWORD_HREF} variant="outlined">
              Alterar senha
            </Button>
          </div>
        </Stack>
      </Card>
    </Reveal>
  );
}

// Student account page: password, privacy (LGPD) and account deletion, kept apart from the professional profile.
export function StudentAccountView() {
  const { user } = useAuth();

  return (
    <Container maxWidth={false} sx={{ maxWidth: CONTENT_MAX_WIDTH, py: { xs: 3, md: 4 }, width: "100%" }}>
      <Stack spacing={3}>
        <PageHeader
          title="Minha conta"
          description="Senha, seus dados pessoais e a exclusão da conta. O seu perfil profissional fica em Meu perfil."
        />
        {/* A demonstration account has no password of its own to change (the menu hides the entry too). */}
        {!user?.modoDemonstracao && <PasswordCard />}
        <PrivacidadeSection
          fetchData={fetchMyDataExport}
          fetchNewsletter={fetchMyNewsletter}
          saveNewsletter={saveMyNewsletter}
        />
        <ExclusaoSection />
      </Stack>
    </Container>
  );
}
