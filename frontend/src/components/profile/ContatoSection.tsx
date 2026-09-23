"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
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
import { formatBrazilianPhone, normalizeEmailInput, normalizeOptionalUrl, normalizePhone, validateBrazilianPhone, validateEmail, validateHttpUrl } from "@/lib/validation";
import { updateContato } from "@/lib/student";
import type { ContatoResponse } from "@/types/student";
import { FormDialog } from "./FormDialog";
import { SectionCard } from "./SectionCard";
import type { SectionProps } from "./sectionProps";


export function ContatoSection({ profile, onChanged, notify }: SectionProps) {
  const [open, setOpen] = useState(false);
  const contato = profile.contato;

  const items: ContactItem[] = [
    { icon: <CallOutlined fontSize="small" />, label: "Telefone", value: contato.telefone, kind: "phone" },
    { icon: <AlternateEmailOutlined fontSize="small" />, label: "E-mail profissional", value: contato.emailProfissional, kind: "email" },
    { icon: <LinkedInOutlined fontSize="small" />, label: "LinkedIn", value: contato.linkedInUrl, kind: "url" },
    { icon: <CodeOutlined fontSize="small" />, label: "GitHub", value: contato.gitHubUrl, kind: "url" },
    { icon: <LanguageOutlined fontSize="small" />, label: "Portfólio", value: contato.portfolioUrl, kind: "url" },
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
              <ContactValue item={item} />
            </Stack>
          ))}
      </Stack>
      {open && (
        <ContatoForm
          contato={contato}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onChanged();
            notify("Contato atualizado.");
          }}
        />
      )}
    </SectionCard>
  );
}

type ContactKind = "phone" | "email" | "url";

interface ContactItem {
  icon: ReactNode;
  label: string;
  value: string | null;
  kind: ContactKind;
}

function resolveContactLink(kind: ContactKind, value: string): { href: string | null; display: string; external: boolean } {
  if (kind === "phone") {
    const digits = normalizePhone(value);
    if (/^\d{10,11}$/.test(digits) && !/^(\d)\1+$/.test(digits) && digits.slice(0, 2) !== "00") {
      return { href: `tel:+55${digits}`, display: formatBrazilianPhone(digits), external: false };
    }
    return { href: null, display: value, external: false };
  }
  if (kind === "email") {
    return validateEmail(value, false) === null
      ? { href: `mailto:${value}`, display: value, external: false }
      : { href: null, display: value, external: false };
  }
  return validateHttpUrl(value) === null
    ? { href: value, display: value, external: true }
    : { href: null, display: value, external: false };
}

// Renders a contact value as an actionable link only when the stored value is a
// valid, safe target (phone digits, e-mail address or http/https URL). Malformed
// legacy values are shown as plain text rather than discarded or linked.
function ContactValue({ item }: { item: ContactItem }) {
  const raw = item.value ?? "";
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const { href, display, external } = resolveContactLink(item.kind, trimmed);
  if (!href) {
    return <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: "break-all" }}>{raw}</Typography>;
  }
  const ariaLabel = external
    ? `Abrir ${item.label} em nova aba`
    : item.kind === "phone"
      ? `Ligar para ${display}`
      : `Enviar e-mail para ${display}`;
  return (
    <Typography
      component="a"
      variant="body2"
      href={href}
      aria-label={ariaLabel}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      sx={{ fontWeight: 600, wordBreak: "break-all", color: "primary.main" }}
    >
      {display}
    </Typography>
  );
}

interface ContatoFormProps {
  contato: ContatoResponse;
  onClose: () => void;
  onSaved: () => void;
}

function ContatoForm({ contato, onClose, onSaved }: ContatoFormProps) {
  const [telefone, setTelefone] = useState(formatBrazilianPhone(contato.telefone ?? ""));
  const [email, setEmail] = useState(contato.emailProfissional ?? "");
  const [linkedin, setLinkedin] = useState(contato.linkedInUrl ?? "");
  const [github, setGithub] = useState(contato.gitHubUrl ?? "");
  const [portfolio, setPortfolio] = useState(contato.portfolioUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedEmail = email.trim();
  const emailInvalid = Boolean(trimmedEmail) && Boolean(validateEmail(trimmedEmail));
  const linkedinInvalid = Boolean(linkedin.trim()) && Boolean(validateHttpUrl(linkedin));
  const githubInvalid = Boolean(github.trim()) && Boolean(validateHttpUrl(github));
  const portfolioInvalid = Boolean(portfolio.trim()) && Boolean(validateHttpUrl(portfolio));

  function validate(): string | null {
    const phoneError = validateBrazilianPhone(telefone, false);
    if (phoneError) return phoneError;
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
      if (value && validateHttpUrl(value)) {
        return `${label} deve ser uma URL válida começando com http:// ou https://.`;
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
        telefone: telefone.trim() ? telefone.replace(/\D/g, "") : null,
        emailProfissional: email.trim() ? normalizeEmailInput(email) : null,
        linkedInUrl: normalizeOptionalUrl(linkedin),
        gitHubUrl: normalizeOptionalUrl(github),
        portfolioUrl: normalizeOptionalUrl(portfolio),
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
          placeholder="(11) 91234-5678"
          slotProps={{ htmlInput: { inputMode: "tel" } }}
          helperText="Opcional. Informe um telefone brasileiro."
        />
        <TextField
          id="contato-email"
          label="E-mail profissional"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value.slice(0, 254))}
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
          onChange={(e) => setLinkedin(e.target.value.slice(0, 2048))}
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
          onChange={(e) => setGithub(e.target.value.slice(0, 2048))}
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
          onChange={(e) => setPortfolio(e.target.value.slice(0, 2048))}
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
