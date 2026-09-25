"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import ArrowBackOutlined from "@mui/icons-material/ArrowBackOutlined";
import { Box, Typography } from "@mui/material";
import { motion, useReducedMotion } from "framer-motion";
import { GuestOnly } from "@/components/auth/GuestOnly";
import { TalentValleyMark } from "@/components/brand/TalentValleyMark";
import "./registration.css";

export function RegistrationLayout({
  title,
  subtitle,
  backHref,
  children,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <GuestOnly>
      <Box component="main" className="tv-registration">
        <Box component="aside" className="tv-registration__brand-region">
          <div className="tv-registration__brand-content">
            <Link href="/" className="tv-registration__brand" aria-label="Talent Valley — página inicial">
              <TalentValleyMark width={64} />
              <span>
                <strong>Talent <em>Valley</em></strong>
                <small>by Rio Pomba Valley</small>
              </span>
            </Link>
            <div className="tv-registration__brand-copy">
              <Typography component="p" className="tv-registration__eyebrow">
                TALENTOS. CONEXÕES. FUTURO.
              </Typography>
              <Typography component="p" className="tv-registration__statement">
                Seu próximo capítulo começa com uma conexão.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Uma comunidade que aproxima a formação de novas possibilidades profissionais.
              </Typography>
            </div>
            <Typography className="tv-registration__institution" variant="caption" color="text.secondary">
              Uma iniciativa Rio Pomba Valley
            </Typography>
          </div>
        </Box>

        <div className="tv-registration__panel">
          <motion.div
            className="tv-registration__content"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25 }}
          >
            <Box component="header" className="tv-registration__header">
              {backHref && (
                <Link href={backHref} className="tv-registration__back">
                  <ArrowBackOutlined fontSize="small" />
                  Voltar para escolher perfil
                </Link>
              )}
              <Typography component="p" className="tv-registration__eyebrow">
                FAÇA PARTE DO TALENT VALLEY
              </Typography>
              <Typography component="h1" variant="h4" className="tv-registration__title">
                {title}
              </Typography>
              {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
              <Typography variant="body2" color="text.secondary" className="tv-registration__notice">
                Seu pedido será analisado pela equipe do Talent Valley antes da criação da conta.
              </Typography>
            </Box>
            {children}
            <Box component="footer" className="tv-registration__footer">
              <Typography variant="body2" color="text.secondary">Já possui acesso?</Typography>
              <Link href="/login">Entrar na plataforma <span aria-hidden="true">↗</span></Link>
            </Box>
          </motion.div>
        </div>
      </Box>
    </GuestOnly>
  );
}

export function RegistrationSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <Box component="section" aria-labelledby={id} className="tv-registration__section">
      <div className="tv-registration__section-heading">
        <Typography id={id} component="h2" variant="h6">{title}</Typography>
        {description && <Typography variant="body2" color="text.secondary">{description}</Typography>}
      </div>
      {children}
    </Box>
  );
}
