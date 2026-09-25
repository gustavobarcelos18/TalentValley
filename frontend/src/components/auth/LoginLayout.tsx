"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { Box, Stack, Typography } from "@mui/material";
import ArrowBack from "@mui/icons-material/ArrowBack";
import { motion, useReducedMotion } from "framer-motion";
import { TalentValleyMark } from "@/components/brand/TalentValleyMark";
import "./login.css";

interface LoginLayoutProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  ariaBusy?: boolean;
  children?: ReactNode;
}

// Login-only two-column composition for AUTH01. The shared AuthPageShell keeps
// its default card layout for the other authentication screens.
export function LoginLayout({
  title,
  subtitle,
  eyebrow = "ACESSO À PLATAFORMA",
  onSubmit,
  ariaBusy,
  children,
}: LoginLayoutProps) {
  const reduceMotion = useReducedMotion();

  const entrance = (delay: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: reduceMotion
      ? { duration: 0 }
      : { duration: 0.4, ease: "easeOut" as const, delay },
  });

  return (
    <Box component="main" className="tv-login">
      <Box component="section" className="tv-login__visual">
        <motion.div className="tv-login__brand" {...entrance(0)}>
          <LoginBrand />
        </motion.div>

        <motion.div className="tv-login__copy" {...entrance(0.08)}>
          <Typography
            component="p"
            style={{ textWrap: "balance" }}
            sx={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(1.7rem, 2.4vw, 2.4rem)",
              fontWeight: 400,
              lineHeight: 1.18,
              letterSpacing: "-0.02em",
              color: "text.primary",
              maxWidth: "22ch",
            }}
          >
            Onde talentos e{" "}
            <Box component="span" sx={{ color: "primary.main" }}>
              oportunidades
            </Box>{" "}
            se encontram.
          </Typography>

          <Typography
            component="p"
            sx={{
              mt: 2.5,
              fontSize: "0.8rem",
              fontWeight: 500,
              letterSpacing: "0.1em",
              color: "text.secondary",
            }}
          >
            Uma iniciativa Rio Pomba Valley
          </Typography>
        </motion.div>
      </Box>

      <Box component="section" className="tv-login__panel">
        <Box className="tv-login__formwrap">
          <motion.div {...entrance(0.06)}>
            <Typography
              component="p"
              sx={{
                mb: 1.5,
                color: "primary.main",
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.2em",
                lineHeight: 1.7,
              }}
            >
              {eyebrow}
            </Typography>

            <Typography component="h1" variant="h4">
              {title}
            </Typography>

            {subtitle && (
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mt: 0.75 }}
              >
                {subtitle}
              </Typography>
            )}
          </motion.div>

          <motion.div {...entrance(0.14)}>
            <Stack
              component="form"
              spacing={2.5}
              onSubmit={onSubmit}
              aria-busy={ariaBusy || undefined}
              noValidate
              sx={{ mt: 3 }}
            >
              {children}
            </Stack>

            <Typography
              align="center"
              variant="body2"
              color="text.secondary"
              sx={{ mt: 3 }}
            >
              Ainda não possui acesso?{" "}
              <Typography
                component={Link}
                href="/cadastro"
                variant="body2"
                sx={{
                  color: "primary.main",
                  fontWeight: 600,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Solicitar cadastro
              </Typography>
            </Typography>

            <Box sx={{ textAlign: "center", mt: 4 }}>
              <Typography
                component={Link}
                href="/"
                variant="body2"
                sx={{
                  color: "text.secondary",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.75,
                  transition: "color 0.2s",
                  "&:hover": { color: "text.primary" },
                }}
              >
                <ArrowBack sx={{ fontSize: "1rem" }} />
                Voltar para o início
              </Typography>
            </Box>
          </motion.div>
        </Box>
      </Box>
    </Box>
  );
}

// Official wordmark style, matching the landing Brand lockup without importing
// the landing's stylesheet.
function LoginBrand() {
  return (
    <Stack direction="row" spacing={1.25} sx={{ alignItems: "center" }}>
      <TalentValleyMark width={46} />
      <Box>
        <Typography
          component="span"
          sx={{
            display: "block",
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: "1.6rem",
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-0.05em",
            color: "text.primary",
          }}
        >
          Talent{" "}
          <Box component="span" sx={{ color: "secondary.main" }}>
            Valley
          </Box>
        </Typography>
        <Typography
          component="span"
          sx={{
            display: "block",
            mt: 0.5,
            fontSize: "0.72rem",
            letterSpacing: "0.015em",
            color: "text.secondary",
          }}
        >
          by Rio Pomba Valley
        </Typography>
      </Box>
    </Stack>
  );
}
