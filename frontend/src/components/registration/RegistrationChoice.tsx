"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import ArrowForwardOutlined from "@mui/icons-material/ArrowForwardOutlined";
import BusinessCenterOutlined from "@mui/icons-material/BusinessCenterOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import { Box, Paper, Typography } from "@mui/material";
import { AuthFormPage } from "@/components/auth/AuthFormPage";
import { TiltCard } from "@/components/auth/motion/TiltCard";
import { SignupFooter } from "./SignupFooter";

// A selectable profile card. It stays a native Next.js Link (rendered as an
// anchor through Paper) so keyboard, middle-click and assistive tech keep the
// default link behavior, while hover/focus states make it feel tappable.
// On a mouse it also leans toward the cursor and a light follows it (TiltCard).
function ChoiceCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <TiltCard>
      <Paper
        component={Link}
        href={href}
        variant="outlined"
        sx={{
          position: "relative",
          isolation: "isolate",
          display: "flex",
          alignItems: "flex-start",
          gap: 2,
          p: 2.5,
          overflow: "hidden",
          color: "text.primary",
          transition: "border-color 160ms ease, background-color 160ms ease",
          "&:hover, &:focus-visible": { borderColor: "primary.main", bgcolor: "action.hover" },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
          "@media (hover: hover)": {
            "&:hover .choice-arrow": { transform: "translateX(3px)" },
            "&:hover .choice-glow": { opacity: 1 },
          },
        }}
      >
        {/* Light that follows the cursor (its position is set by TiltCard); only shown on hover. */}
        <Box
          aria-hidden
          className="choice-glow"
          sx={(theme) => ({
            position: "absolute",
            inset: 0,
            zIndex: -1,
            opacity: 0,
            pointerEvents: "none",
            transition: "opacity 200ms ease",
            background: `radial-gradient(260px circle at var(--glow-x, 50%) var(--glow-y, 50%), color-mix(in srgb, ${(theme.vars ?? theme).palette.primary.main} 16%, transparent), transparent 70%)`,
          })}
        />
        <Box
          aria-hidden
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: 48,
            height: 48,
            border: 1,
            borderColor: "divider",
            borderRadius: 3,
            color: "primary.main",
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography component="h2" variant="h6">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        </Box>
        <ArrowForwardOutlined
          aria-hidden
          fontSize="small"
          className="choice-arrow"
          sx={{ mt: 0.5, color: "text.secondary", transition: "transform 160ms ease" }}
        />
      </Paper>
    </TiltCard>
  );
}

// First screen of the signup: the person picks the profile that decides which
// wizard comes next. The cards are direct children of the form area, so the
// entry cascade brings them in one after the other.
export function RegistrationChoice() {
  return (
    <AuthFormPage
      eyebrow="FAÇA PARTE DO TALENT VALLEY"
      title="Como deseja participar?"
      subtitle="Escolha seu perfil para solicitar acesso ao Talent Valley."
      footer={<SignupFooter backHref="/" backLabel="Voltar para o início" />}
    >
      <ChoiceCard
        href="/cadastro/aluno"
        icon={<SchoolOutlined />}
        title="Sou aluno"
        description="Após aprovação, crie seu perfil profissional e apresente sua trajetória."
      />
      <ChoiceCard
        href="/cadastro/recrutador"
        icon={<BusinessCenterOutlined />}
        title="Sou Recrutador"
        description="Solicite acesso para descobrir talentos da comunidade Rio Pomba Valley."
      />
    </AuthFormPage>
  );
}
