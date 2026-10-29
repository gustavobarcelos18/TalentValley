"use client";

import Link from "next/link";
import { Alert, Box, Button, Container, Stack, Typography } from "@mui/material";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import CheckCircleOutlined from "@mui/icons-material/CheckCircleOutlined";
import RadioButtonUncheckedOutlined from "@mui/icons-material/RadioButtonUncheckedOutlined";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { PageHeader } from "@/components/common/PageHeader";
import { SurfaceCard } from "@/components/common/SurfaceCard";
import { CONTENT_MAX_WIDTH } from "@/components/layout/contentWidth";
import { PrivacyNotice } from "@/components/profile/PrivacyNotice";
import { useStudentProfile } from "@/hooks/useStudentProfile";
import { formatUpdatedAt } from "@/lib/format";
import type { MeResponse } from "@/types/student";
import { PROFILE_PATH, buildHomeSteps, type HomeStep } from "./studentHomeSteps";

function StepRow({ step }: { step: HomeStep }) {
  const content = (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", py: 1.25 }}>
      {step.done ? (
        <CheckCircleOutlined color="success" aria-hidden="true" />
      ) : (
        <RadioButtonUncheckedOutlined sx={{ color: "text.secondary" }} aria-hidden="true" />
      )}
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography component="span" variant="subtitle2" sx={{ color: step.done ? "text.secondary" : "text.primary" }}>
          {step.label}
          <Box component="span" className="sr-only">
            {step.done ? " (feito)" : " (pendente)"}
          </Box>
        </Typography>
        {!step.done && (
          <Typography variant="body2" color="text.secondary">
            {step.hint}
          </Typography>
        )}
      </Box>
      {!step.done && <ArrowForwardOutlined fontSize="small" sx={{ color: "text.secondary" }} aria-hidden="true" />}
    </Stack>
  );

  // Only a pending step leads somewhere: a finished one is just a mark in the list.
  if (step.done) return <li>{content}</li>;
  return (
    <li>
      <Box
        component={Link}
        href={step.href}
        sx={{
          display: "block",
          color: "inherit",
          textDecoration: "none",
          borderRadius: 1,
          "&:hover": { backgroundColor: "action.hover" },
        }}
      >
        {content}
      </Box>
    </li>
  );
}

function NextSteps({ profile }: { profile: MeResponse }) {
  const steps = buildHomeSteps(profile);
  const allDone = steps.every((step) => step.done);

  return (
    <SurfaceCard title="Próximos passos" index={0}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {allDone
          ? "Tudo preenchido. Volte aqui sempre que algo mudar na sua trajetória."
          : "Um perfil preenchido é mais fácil de encontrar. Escolha um passo pendente para ir direto à seção."}
      </Typography>
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0 }}>
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </Box>
    </SurfaceCard>
  );
}

function HowRecruitersFindYou() {
  return (
    <SurfaceCard title="Como os recrutadores encontram você" index={1}>
      <Stack spacing={1.5}>
        <Typography variant="body2" color="text.secondary">
          Recrutadores aprovados pelo Instituto buscam alunos por cidade, formação, competências e pelo que cada um procura no momento.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Eles veem apenas o que você preenche no seu perfil e entram em contato por fora da plataforma, pelos meios que você informar.
        </Typography>
      </Stack>
    </SurfaceCard>
  );
}

// Home of the student: what is missing in the profile and who sees it. No percentage, bar or counter.
export function StudentHome() {
  const { profile, loading, error, refresh } = useStudentProfile();
  const firstName = profile?.dadosBasicos.nomeCompleto.trim().split(/\s+/)[0];

  return (
    <Container maxWidth={false} sx={{ maxWidth: CONTENT_MAX_WIDTH, py: { xs: 3, md: 4 }, width: "100%" }}>
      {loading && <LoadingSkeleton count={3} height={150} />}

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
        <Stack spacing={3}>
          <PageHeader
            title={firstName ? `Olá, ${firstName}` : "Olá"}
            description="Veja o que falta no seu perfil e quem pode vê-lo."
            action={
              <Button component={Link} href={PROFILE_PATH} variant="outlined">
                Ir para o meu perfil
              </Button>
            }
          />
          <PrivacyNotice />
          <NextSteps profile={profile} />
          <HowRecruitersFindYou />
          <Typography variant="caption" color="text.secondary">
            Perfil atualizado em {formatUpdatedAt(profile.atualizadoEm)}
          </Typography>
        </Stack>
      )}
    </Container>
  );
}
