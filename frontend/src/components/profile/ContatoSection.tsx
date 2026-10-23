"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  Box,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AlternateEmailOutlined from "@mui/icons-material/AlternateEmailOutlined";
import CallOutlined from "@mui/icons-material/CallOutlined";
import CodeOutlined from "@mui/icons-material/CodeOutlined";
import ContactPhoneOutlined from "@mui/icons-material/ContactPhoneOutlined";
import LanguageOutlined from "@mui/icons-material/LanguageOutlined";
import LinkedInOutlined from "@mui/icons-material/LinkedIn";
import { getApiErrorMessage } from "@/lib/api";
import { formatBrazilianPhone, maskPhoneChange, normalizeEmailInput, normalizeOptionalUrl, normalizePhone, stripEmoji, stripEmojiOnPaste, validateBrazilianPhone, validateEmail, validateHttpUrl, validateTypedLink, withHttpsScheme, OPTIONAL_LINK_HINT } from "@/lib/validation";
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

  const filledItems = items.filter((item): item is FilledContactItem => Boolean(item.value?.trim()));

  return (
    <SectionCard
      title="Contato"
      editLabel="Editar contato"
      onEdit={() => setOpen(true)}
      isEmpty={filledItems.length === 0}
      emptyMessage="Informe como recrutadores podem falar com você."
      emptyActionLabel="Adicionar contato"
      emptyIcon={<ContactPhoneOutlined />}
    >
      <Stack divider={<Divider flexItem />} spacing={1.5}>
        {filledItems.map((item) => (
          <Stack key={item.label} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Box
              component="span"
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center"
              sx={(theme) => {
                const { primary, surface } = (theme.vars ?? theme).palette;
                return { color: primary.main, backgroundColor: surface.sunken, borderRadius: "10px" };
              }}
            >
              {item.icon}
            </Box>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={{ xs: 0, sm: 1.5 }}
              sx={{ minWidth: 0, flex: 1, alignItems: { sm: "center" } }}
            >
              <Typography
                variant="body2"
                sx={{ minWidth: { sm: 130 }, color: "text.secondary" }}
              >
                {item.label}
              </Typography>
              <ContactValue item={item} />
            </Stack>
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

type FilledContactItem = ContactItem & { value: string };

function resolveContactLink(kind: ContactKind, value: string): { href: string | null; display: string; external: boolean } {
  if (kind === "phone") {
    if (validateBrazilianPhone(value) === null) {
      const digits = normalizePhone(value);
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
function ContactValue({ item }: { item: FilledContactItem }) {
  const raw = item.value;
  const trimmed = raw.trim();
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
  const [submitted, setSubmitted] = useState(false);
  const trimmedEmail = email.trim();
  const emailInvalid = Boolean(trimmedEmail) && Boolean(validateEmail(trimmedEmail));
  const linkedinError = validateTypedLink(linkedin, { domain: "linkedin.com", name: "LinkedIn" });
  const githubError = validateTypedLink(github, { domain: "github.com", name: "GitHub" });
  const portfolioError = validateTypedLink(portfolio);
  const linkedinInvalid = Boolean(linkedinError);
  const githubInvalid = Boolean(githubError);
  const portfolioInvalid = Boolean(portfolioError);
  const phoneError = validateBrazilianPhone(telefone, false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (phoneError || emailInvalid || linkedinInvalid || githubInvalid || portfolioInvalid) {
      setError(null);
      setSubmitted(true);
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
          onChange={(e) => setTelefone(maskPhoneChange(e))}
          fullWidth
          disabled={saving}
          placeholder="(11) 91234-5678"
          slotProps={{ htmlInput: { inputMode: "tel" } }}
          error={submitted && Boolean(phoneError)}
          helperText={submitted && phoneError ? phoneError : "Opcional. Informe um telefone brasileiro."}
        />
        <TextField
          id="contato-email"
          label="E-mail profissional"
          type="email"
          value={email}
          onChange={(e) => setEmail(stripEmoji(e.target.value).slice(0, 254))}
          fullWidth
          disabled={saving}
          error={emailInvalid}
          helperText={emailInvalid ? "Informe um e-mail válido." : "Diferente do e-mail de login. Opcional."}
          slotProps={{ htmlInput: { maxLength: 254, inputMode: "email", autoCapitalize: "none", onPaste: stripEmojiOnPaste } }}
        />
        <TextField
          id="contato-linkedin"
          label="LinkedIn"
          value={linkedin}
          onChange={(e) => setLinkedin(stripEmoji(e.target.value).slice(0, 2048))}
          onBlur={() => setLinkedin(withHttpsScheme)}
          placeholder="https://www.linkedin.com/in/seu-perfil"
          fullWidth
          disabled={saving}
          type="url"
          error={linkedinInvalid}
          helperText={linkedinError ?? OPTIONAL_LINK_HINT}
          slotProps={{ htmlInput: { maxLength: 2048, inputMode: "url", onPaste: stripEmojiOnPaste } }}
        />
        <TextField
          id="contato-github"
          label="GitHub"
          value={github}
          onChange={(e) => setGithub(stripEmoji(e.target.value).slice(0, 2048))}
          onBlur={() => setGithub(withHttpsScheme)}
          placeholder="https://github.com/seu-usuario"
          fullWidth
          disabled={saving}
          type="url"
          error={githubInvalid}
          helperText={githubError ?? OPTIONAL_LINK_HINT}
          slotProps={{ htmlInput: { maxLength: 2048, inputMode: "url", onPaste: stripEmojiOnPaste } }}
        />
        <TextField
          id="contato-portfolio"
          label="Portfólio"
          value={portfolio}
          onChange={(e) => setPortfolio(stripEmoji(e.target.value).slice(0, 2048))}
          onBlur={() => setPortfolio(withHttpsScheme)}
          placeholder="https://seu-portfolio.com"
          fullWidth
          disabled={saving}
          type="url"
          error={portfolioInvalid}
          helperText={portfolioError ?? OPTIONAL_LINK_HINT}
          slotProps={{ htmlInput: { maxLength: 2048, inputMode: "url", onPaste: stripEmojiOnPaste } }}
        />
      </Stack>
    </FormDialog>
  );
}
