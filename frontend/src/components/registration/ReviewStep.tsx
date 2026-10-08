"use client";

import type { ReactNode } from "react";
import { Box, Button, Paper, Typography } from "@mui/material";
import { motion } from "framer-motion";
import { duration, ease } from "@/components/auth/motion/tokens";
import { useMotionPolicy } from "@/components/auth/motion/useMotionPolicy";
import { ConsentField } from "./ConsentField";
import type { CommonForm, FocusableControl } from "./registrationForm";

const EMPTY = "Não informado";

function SummaryCard({
  title,
  editLabel,
  onEdit,
  disabled,
  children,
}: {
  title: string;
  editLabel: string;
  onEdit: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <Paper variant="outlined" component="section" sx={{ p: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, mb: 0.5 }}>
        <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
        <Button type="button" size="small" onClick={onEdit} disabled={disabled} aria-label={editLabel}>
          Editar
        </Button>
      </Box>
      <Box component="dl" sx={{ m: 0, display: "grid", gap: 0.75 }}>
        {children}
      </Box>
    </Paper>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    // Label and value share a line (the value drops below when it does not fit), to keep the card short.
    <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", columnGap: 1 }}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}:
      </Typography>
      <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: "anywhere" }}>
        {value || EMPTY}
      </Typography>
    </Box>
  );
}

// Second summary card of the review: the profile-specific data (education for
// students, company for recruiters), always reached through step 1.
export interface ReviewDetails {
  title: string;
  editLabel: string;
  rows: { label: string; value: string }[];
}

interface ReviewStepProps {
  personal: CommonForm;
  details: ReviewDetails;
  consent: boolean;
  consentError: string | null | undefined;
  disabled: boolean;
  /** The summary folds away while the request is being sent, and unfolds again if it fails. */
  collapsed: boolean;
  onConsentChange: (checked: boolean) => void;
  onEditStep: (step: number) => void;
  registerFieldRef: (key: string) => (node: FocusableControl) => void;
}

// Delay between the two cards as they fold, so one goes after the other.
const FOLD_STAGGER = 0.06;

/** How long the summary takes to fold away; the wizards wait this long before sending. */
export const REVIEW_FOLD_MS = Math.round((duration.base + FOLD_STAGGER) * 1000);

// Step "Revisão e termos" of the signup wizards: read-only summary with a way
// back to each step, plus the terms consent that gates the submission.
export function ReviewStep({
  personal,
  details,
  consent,
  consentError,
  disabled,
  collapsed,
  onConsentChange,
  onEditStep,
  registerFieldRef,
}: ReviewStepProps) {
  const policy = useMotionPolicy();
  const animated = policy === "touch" || policy === "pointer";
  // With reduced motion the summary still folds, but at once.
  const timing = (delay: number) =>
    animated ? { duration: duration.base, ease: ease.inOut, delay: collapsed ? delay : 0 } : { duration: 0 };
  const fold = (index: number) => ({
    animate: {
      opacity: collapsed ? 0 : 1,
      transform: collapsed && animated ? "translateY(-12px) scale(0.97)" : "translateY(0px) scale(1)",
    },
    initial: false as const,
    transition: timing(index * FOLD_STAGGER),
  });

  return (
    <div className="sm:col-span-2">
      {/* Gap between the cards and the consent lives in the margin, so it folds away with them. */}
      <motion.div
        initial={false}
        animate={{ height: collapsed ? 0 : "auto", marginBottom: collapsed ? 0 : 16 }}
        transition={timing(FOLD_STAGGER)}
        style={{ overflow: "hidden" }}
        // The folded summary is out of the tab order and the accessibility tree.
        inert={collapsed}
      >
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <motion.div {...fold(0)}>
            <SummaryCard
              title="Dados pessoais"
              editLabel="Editar dados pessoais"
              onEdit={() => onEditStep(0)}
              disabled={disabled}
            >
              <SummaryRow label="Nome completo" value={personal.nomeCompleto} />
              <SummaryRow label="E-mail" value={personal.email} />
              <SummaryRow label="Telefone" value={personal.telefone} />
              <SummaryRow label="CEP" value={personal.cep} />
              <SummaryRow label="Cidade e estado" value={`${personal.cidade} - ${personal.uf}`} />
            </SummaryCard>
          </motion.div>

          <motion.div {...fold(1)}>
            <SummaryCard
              title={details.title}
              editLabel={details.editLabel}
              onEdit={() => onEditStep(1)}
              disabled={disabled}
            >
              {details.rows.map((row) => (
                <SummaryRow key={row.label} label={row.label} value={row.value} />
              ))}
            </SummaryCard>
          </motion.div>
        </div>
      </motion.div>

      <ConsentField
        checked={consent}
        error={consentError}
        disabled={disabled}
        onChange={onConsentChange}
        inputRef={registerFieldRef("consentTermos")}
      />
    </div>
  );
}
