"use client";

import { useState, type FormEvent } from "react";
import {
  Dialog,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AlternateEmailOutlined from "@mui/icons-material/AlternateEmailOutlined";
import CallOutlined from "@mui/icons-material/CallOutlined";
import CodeOutlined from "@mui/icons-material/CodeOutlined";
import LanguageOutlined from "@mui/icons-material/LanguageOutlined";
import LinkedInOutlined from "@mui/icons-material/LinkedIn";
import { getApiErrorMessage } from "@/lib/api";
import { validateEmail } from "@/lib/validation";
import { updateContato } from "@/lib/student";
import type { ContatoResponse } from "@/types/student";
import { FormDialog } from "./FormDialog";
import { SectionCard } from "./SectionCard";
import type { SectionProps } from "./sectionProps";

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

const emojiPattern = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D\u20E3\u{E0020}-\u{E007F}]/gu;
const keycapPattern = /[#*0-9]\uFE0F?\u20E3/gu;
function sanitizeLinkInput(value: string): string {
  return value.replace(keycapPattern, "").replace(emojiPattern, "");
}

function sanitizeEmailInput(value: string): string {
  return value.replace(/[^\w.!#$%&'*+/=?^_`{|}~@-]/g, "");
}

function maskBrazilianPhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (value.trim().startsWith("+55") || (digits.length > 11 && digits.startsWith("55"))) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (!digits) return "";

  const areaCode = digits.slice(0, 2);
  const subscriber = digits.slice(2);
  if (digits.length <= 2) return `+55 (${areaCode}`;
  if (subscriber.length <= 4) return `+55 (${areaCode}) ${subscriber}`;
  const splitAt = subscriber.length > 8 ? 5 : 4;
  return `+55 (${areaCode}) ${subscriber.slice(0, splitAt)}-${subscriber.slice(splitAt)}`;
}

export function ContatoSection({ profile, onChanged, notify }: SectionProps) {
  const [open, setOpen] = useState(false);
  const contato = profile.contato;

  const items = [
    { icon: <CallOutlined fontSize="small" />, label: "Telefone", value: contato.telefone },
    {
      icon: <AlternateEmailOutlined fontSize="small" />,
      label: "E-mail profissional",
      value: contato.emailProfissional,
    },
    { icon: <LinkedInOutlined fontSize="small" />, label: "LinkedIn", value: contato.linkedInUrl },
    { icon: <CodeOutlined fontSize="small" />, label: "GitHub", value: contato.gitHubUrl },
    {
      icon: <LanguageOutlined fontSize="small" />,
      label: "Portfólio",
      value: contato.portfolioUrl,
    },
  ];

  const hasAny = items.some((item) => Boolean(item.value));

  return (
    <SectionCard
      title="Contato"
      editLabel="Editar contato"
      onEdit={() => setOpen(true)}
      isEmpty={!hasAny}
      emptyMessage="Informe como recrutadores podem falar com você."
      emptyActionLabel="Adicionar contato"
    >
      <Stack divider={<Divider flexItem />} spacing={1.5}>
        {items
          .filter((item) => Boolean(item.value))
          .map((item) => (
            <Stack key={item.label} direction="row" spacing={1.5}>
              <Typography
                component="span"
                aria-hidden
                sx={{alignItems: "center",  display: "inline-flex", color: "primary.main" }}
              >
                {item.icon}
              </Typography>
              <Typography
                variant="body2"
                sx={{ minWidth: 130, color: "text.secondary" }}
              >
                {item.label}
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, wordBreak: "break-all" }}
              >
                {item.value}
              </Typography>
            </Stack>
          ))}
      </Stack>
      <ContatoDialog
        open={open}
        onClose={() => setOpen(false)}
        contato={contato}
        onSaved={() => {
          setOpen(false);
          onChanged();
          notify("Contato atualizado.");
        }}
      />
    </SectionCard>
  );
}

interface ContatoDialogProps {
  open: boolean;
  onClose: () => void;
  contato: ContatoResponse;
  onSaved: () => void;
}

// The dialog stays mounted for the open/close transition; the form only mounts
// while open, so its state always starts from the current profile values.
function ContatoDialog({ open, onClose, contato, onSaved }: ContatoDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <ContatoForm contato={contato} onClose={onClose} onSaved={onSaved} />
      )}
    </Dialog>
  );
}

interface ContatoFormProps {
  contato: ContatoResponse;
  onClose: () => void;
  onSaved: () => void;
}

function ContatoForm({ contato, onClose, onSaved }: ContatoFormProps) {
  const [telefone, setTelefone] = useState(maskBrazilianPhone(contato.telefone ?? ""));
  const [email, setEmail] = useState(contato.emailProfissional ?? "");
  const [linkedin, setLinkedin] = useState(contato.linkedInUrl ?? "");
  const [github, setGithub] = useState(contato.gitHubUrl ?? "");
  const [portfolio, setPortfolio] = useState(contato.portfolioUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedEmail = email.trim();
  const emailInvalid = Boolean(trimmedEmail) && Boolean(validateEmail(trimmedEmail));
  const linkedinInvalid = Boolean(linkedin.trim()) && !isValidHttpUrl(linkedin.trim());
  const githubInvalid = Boolean(github.trim()) && !isValidHttpUrl(github.trim());
  const portfolioInvalid = Boolean(portfolio.trim()) && !isValidHttpUrl(portfolio.trim());

  function validate(): string | null {
    if (telefone.trim().length > 20) {
      return "O telefone deve ter no máximo 20 caracteres.";
    }
    if (trimmedEmail) {
      const emailError = validateEmail(trimmedEmail);
      if (emailError) {
        return "Informe um e-mail profissional válido.";
      }
    }
    const urls: Array<[string, string]> = [
      ["LinkedIn", linkedin.trim()],
      ["GitHub", github.trim()],
      ["Portfólio", portfolio.trim()],
    ];
    for (const [label, value] of urls) {
      if (value && !isValidHttpUrl(value)) {
        return `${label} deve ser uma URL válida começando com http:// ou https://`;
      }
    }
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validation = validate();
    if (validation) {
      setError(validation);
      return;
    }

    setError(null);
    setSaving(true);
    try {
      await updateContato({
        telefone: telefone.trim() || null,
        emailProfissional: email.trim() || null,
        linkedInUrl: linkedin.trim() || null,
        gitHubUrl: github.trim() || null,
        portfolioUrl: portfolio.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Não foi possível salvar o contato. Tente novamente.")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      title="Editar contato"
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
      error={error}
    >
      <Stack spacing={2.5}>
        <TextField
          id="contato-telefone"
          label="Telefone"
          value={telefone}
          onChange={(e) => setTelefone(maskBrazilianPhone(e.target.value))}
          fullWidth
          disabled={saving}
          placeholder="+55 (11) 91234-5678"
          slotProps={{ htmlInput: { inputMode: "numeric", maxLength: 20 } }}
          helperText="Opcional, até 20 caracteres."
        />
        <TextField
          id="contato-email"
          label="E-mail profissional"
          type="text"
          value={email}
          onChange={(e) => setEmail(sanitizeEmailInput(e.target.value).slice(0, 254))}
          fullWidth
          disabled={saving}
          error={emailInvalid}
          helperText={emailInvalid ? "Informe um e-mail válido." : "Diferente do e-mail de login. Opcional."}
          slotProps={{ htmlInput: { maxLength: 254, inputMode: "email", autoCapitalize: "none" } }}
        />
        <TextField
          id="contato-linkedin"
          label="LinkedIn"
          value={linkedin}
          onChange={(e) => setLinkedin(sanitizeLinkInput(e.target.value))}
          placeholder="https://www.linkedin.com/in/seu-perfil"
          fullWidth
          disabled={saving}
          type="url"
          error={linkedinInvalid}
          helperText={linkedinInvalid ? "Informe uma URL completa iniciada por http:// ou https://." : "Opcional. Use uma URL HTTP ou HTTPS."}
          slotProps={{ htmlInput: { maxLength: 2048, inputMode: "url" } }}
        />
        <TextField
          id="contato-github"
          label="GitHub"
          value={github}
          onChange={(e) => setGithub(sanitizeLinkInput(e.target.value))}
          placeholder="https://github.com/seu-usuario"
          fullWidth
          disabled={saving}
          type="url"
          error={githubInvalid}
          helperText={githubInvalid ? "Informe uma URL completa iniciada por http:// ou https://." : "Opcional. Use uma URL HTTP ou HTTPS."}
          slotProps={{ htmlInput: { maxLength: 2048, inputMode: "url" } }}
        />
        <TextField
          id="contato-portfolio"
          label="Portfólio"
          value={portfolio}
          onChange={(e) => setPortfolio(sanitizeLinkInput(e.target.value))}
          placeholder="https://seu-portfolio.com"
          fullWidth
          disabled={saving}
          type="url"
          error={portfolioInvalid}
          helperText={portfolioInvalid ? "Informe uma URL completa iniciada por http:// ou https://." : "Opcional. Use uma URL HTTP ou HTTPS."}
          slotProps={{ htmlInput: { maxLength: 2048, inputMode: "url" } }}
        />
      </Stack>
    </FormDialog>
  );
}
