"use client";

import { useState, type FormEvent } from "react";
import { Stack, TextField, Typography } from "@mui/material";
import { getApiErrorMessage } from "@/lib/api";
import { sanitizeBio } from "@/lib/validation";
import { updateSobre } from "@/lib/student";
import { FormDialog } from "./FormDialog";
import { SectionCard } from "./SectionCard";
import type { SectionProps } from "./sectionProps";

const BIO_MAX_LENGTH = 1500;

export function SobreSection({ profile, onChanged, notify }: SectionProps) {
  const [open, setOpen] = useState(false);
  const bio = profile.sobre.bio;

  return (
    <SectionCard
      title="Sobre"
      editLabel="Editar sobre"
      onEdit={() => setOpen(true)}
      isEmpty={!bio}
      emptyMessage="Conte um pouco sobre você, sua experiência e objetivos profissionais."
      emptyActionLabel="Escrever sobre"
    >
      <Typography
        variant="body2"
        sx={{
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          color: "text.primary",
        }}
      >
        {bio}
      </Typography>
      {open && (
        <SobreForm
          bio={bio}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            onChanged();
            notify("Sobre atualizado.");
          }}
        />
      )}
    </SectionCard>
  );
}

interface SobreFormProps {
  bio: string | null;
  onClose: () => void;
  onSaved: () => void;
}

function SobreForm({ bio, onClose, onSaved }: SobreFormProps) {
  const [value, setValue] = useState(() => sanitizeBio(bio ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Blank becomes null, matching the backend semantics (empty bio stored as null).
      await updateSobre({ bio: value.trim() ? value.trim() : null });
      onSaved();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Não foi possível salvar o sobre. Tente novamente.")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      title="Editar sobre"
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
      error={error}
    >
      <TextField
        id="sobre-bio"
        label="Sobre você"
        value={value}
        onChange={(e) => setValue(sanitizeBio(e.target.value))}
        multiline
        rows={7}
        fullWidth
        disabled={saving}
        helperText={`${value.length} de ${BIO_MAX_LENGTH} caracteres`}
        slotProps={{
          htmlInput: { maxLength: BIO_MAX_LENGTH, "aria-label": "Sobre você" },
        }}
      />
      <Stack sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Um resumo profissional ajuda recrutadores a conhecerem seu perfil.
        </Typography>
      </Stack>
    </FormDialog>
  );
}
