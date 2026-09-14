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
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
  const [telefone, setTelefone] = useState(contato.telefone ?? "");
  const [email, setEmail] = useState(contato.emailProfissional ?? "");
  const [linkedin, setLinkedin] = useState(contato.linkedInUrl ?? "");
  const [github, setGithub] = useState(contato.gitHubUrl ?? "");
  const [portfolio, setPortfolio] = useState(contato.portfolioUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validate(): string | null {
    if (telefone.trim().length > 20) {
      return "O telefone deve ter no máximo 20 caracteres.";
    }
    const trimmedEmail = email.trim();
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
          onChange={(e) => setTelefone(e.target.value)}
          fullWidth
          disabled={saving}
          helperText="Opcional, até 20 caracteres."
        />
        <TextField
          id="contato-email"
          label="E-mail profissional"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          disabled={saving}
          helperText="Diferente do e-mail de login. Opcional."
        />
        <TextField
          id="contato-linkedin"
          label="LinkedIn"
          value={linkedin}
          onChange={(e) => setLinkedin(e.target.value)}
          placeholder="https://www.linkedin.com/in/seu-perfil"
          fullWidth
          disabled={saving}
        />
        <TextField
          id="contato-github"
          label="GitHub"
          value={github}
          onChange={(e) => setGithub(e.target.value)}
          placeholder="https://github.com/seu-usuario"
          fullWidth
          disabled={saving}
        />
        <TextField
          id="contato-portfolio"
          label="Portfólio"
          value={portfolio}
          onChange={(e) => setPortfolio(e.target.value)}
          placeholder="https://seu-portfolio.com"
          fullWidth
          disabled={saving}
        />
      </Stack>
    </FormDialog>
  );
}
