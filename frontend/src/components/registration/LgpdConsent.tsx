"use client";

import { useId, useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormHelperText,
  Stack,
  Typography,
} from "@mui/material";
import { LGPD_ESSENTIAL_LABEL, LGPD_MARKETING_LABEL, LGPD_TERMS_PLACEHOLDER } from "./lgpdTerms";
import type { FocusableControl } from "./registrationForm";

// Dois aceites LGPD do cadastro: o essencial (obrigatório, trava o envio) e o
// de comunicações (opcional). O botão "Ler Termos da LGPD" abre o modal sem
// sair da página; o texto vem de LGPD_TERMS_PLACEHOLDER para troca fácil.
export function LgpdConsent({
  essential,
  essentialError,
  marketing,
  disabled,
  onEssentialChange,
  onMarketingChange,
  essentialInputRef,
}: {
  essential: boolean;
  essentialError: string | null | undefined;
  marketing: boolean;
  disabled: boolean;
  onEssentialChange: (checked: boolean) => void;
  onMarketingChange: (checked: boolean) => void;
  essentialInputRef: (node: FocusableControl) => void;
}) {
  const [termsOpen, setTermsOpen] = useState(false);
  const titleId = useId();
  return (
    <>
      <FormControlLabel
        sx={{ ml: 0, mr: 0 }}
        control={
          <Checkbox
            checked={essential}
            onChange={(event) => onEssentialChange(event.target.checked)}
            slotProps={{ input: { ref: essentialInputRef } }}
            disabled={disabled}
            required
          />
        }
        label={
          <>
            {LGPD_ESSENTIAL_LABEL}{" "}
            <Button
              type="button"
              variant="text"
              size="small"
              disabled={disabled}
              onClick={() => setTermsOpen(true)}
              sx={{ textTransform: "none", minWidth: 0, p: 0.25 }}
            >
              Ler Termos da LGPD
            </Button>
          </>
        }
      />
      {essentialError && <FormHelperText error>{essentialError}</FormHelperText>}
      <FormControlLabel
        sx={{ ml: 0, mr: 0 }}
        control={
          <Checkbox checked={marketing} onChange={(event) => onMarketingChange(event.target.checked)} disabled={disabled} />
        }
        label={LGPD_MARKETING_LABEL}
      />
      <Dialog open={termsOpen} onClose={() => setTermsOpen(false)} fullWidth maxWidth="sm" aria-labelledby={titleId}>
        <DialogTitle id={titleId}>{LGPD_TERMS_PLACEHOLDER.title}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            <Typography>{LGPD_TERMS_PLACEHOLDER.intro}</Typography>
            {LGPD_TERMS_PLACEHOLDER.sections.map((section) => (
              <Stack key={section.title} component="section" spacing={0.75}>
                <Typography component="h3" variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {section.title}
                </Typography>
                {section.paragraphs.map((text) => (
                  <Typography key={text} color="text.secondary">
                    {text}
                  </Typography>
                ))}
              </Stack>
            ))}
            <Typography variant="body2" color="text.secondary">
              {LGPD_TERMS_PLACEHOLDER.contact}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button type="button" variant="contained" onClick={() => setTermsOpen(false)} autoFocus>
            Entendi
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
