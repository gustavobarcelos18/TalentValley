"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Alert,
  Autocomplete,
  Chip,
  Dialog,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getApiErrorMessage } from "@/lib/api";
import { NIVEL_IDIOMA_LABELS, NIVEL_IDIOMA_OPCOES } from "@/lib/labels";
import { fetchIdiomaCatalog, updateIdiomas } from "@/lib/student";
import type { CatalogoIdiomaResponse, NivelIdioma } from "@/types/student";
import { FormDialog } from "./FormDialog";
import { SectionCard } from "./SectionCard";
import type { SectionProps } from "./sectionProps";

interface IdiomaSelecionado {
  id: number;
  nome: string;
  nivel: NivelIdioma;
}
export function IdiomasSection({ profile, onChanged, notify }: SectionProps) {
  const [open, setOpen] = useState(false);
  const idiomas = profile.idiomas;

  return (
    <SectionCard
      title="Idiomas"
      editLabel="Editar idiomas"
      onEdit={() => setOpen(true)}
      isEmpty={idiomas.length === 0}
      emptyMessage="Informe os idiomas que você fala e o nível de cada um."
      emptyActionLabel="Adicionar idiomas"
    >
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {idiomas.map((idioma) => (
          <Chip
            key={idioma.idiomaId}
            label={`${idioma.nome} - ${NIVEL_IDIOMA_LABELS[idioma.nivel]}`}
            variant="outlined"
            size="small"
          />
        ))}
      </Stack>
      <IdiomasDialog
        open={open}
        onClose={() => setOpen(false)}
        selecionados={idiomas.map((idioma) => ({
          id: idioma.idiomaId,
          nome: idioma.nome,
          nivel: idioma.nivel,
        }))}
        onSaved={() => {
          setOpen(false);
          onChanged();
          notify("Idiomas atualizados.");
        }}
      />
    </SectionCard>
  );
}
interface IdiomasDialogProps {
  open: boolean;
  onClose: () => void;
  selecionados: IdiomaSelecionado[];
  onSaved: () => void;
}

function IdiomasDialog({ open, onClose, selecionados, onSaved }: IdiomasDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      {open && (
        <IdiomasForm
          selecionados={selecionados}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

interface IdiomasFormProps {
  selecionados: IdiomaSelecionado[];
  onClose: () => void;
  onSaved: () => void;
}

function IdiomasForm({ selecionados, onClose, onSaved }: IdiomasFormProps) {
  const [catalogo, setCatalogo] = useState<CatalogoIdiomaResponse[] | null>(null);
  const [catalogoError, setCatalogoError] = useState(false);
  const [selecao, setSelecao] = useState<IdiomaSelecionado[]>(selecionados);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchIdiomaCatalog()
      .then((items) => {
        if (active) setCatalogo(items);
      })
      .catch(() => {
        if (active) setCatalogoError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const opcoes = catalogo ?? [];
  const catalogoLoading = catalogo === null && !catalogoError;

  function setNivel(id: number, nivel: NivelIdioma) {
    setSelecao((prev) =>
      prev.map((item) => (item.id === id ? { ...item, nivel } : item))
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updateIdiomas({
        idiomas: selecao.map((item) => ({ idiomaId: item.id, nivel: item.nivel })),
      });
      onSaved();
    } catch (err) {
      setError(
        getApiErrorMessage(err, "Não foi possível salvar os idiomas. Tente novamente.")
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormDialog
      title="Editar idiomas"
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
      error={error}
    >
      <Stack spacing={2.5}>
        {catalogoError && (
          <Alert severity="warning" role="alert">
            Não foi possível carregar o catálogo de idiomas.
          </Alert>
        )}
        <Autocomplete
          multiple
          disableCloseOnSelect
          options={opcoes}
          value={selecao.map(({ id, nome }) => ({ id, nome }))}
          onChange={(_, value) =>
            setSelecao(
              value.map((option) => {
                const existing = selecao.find((item) => item.id === option.id);
                // New languages start at "Básico" and can be adjusted below.
                return existing ?? { id: option.id, nome: option.nome, nivel: "BASICO" };
              })
            )
          }
          getOptionLabel={(option) => option.nome}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          loading={catalogoLoading}
          disabled={saving || catalogoLoading}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Idiomas"
              placeholder="Buscar idioma"
              slotProps={{ htmlInput: { "aria-label": "Buscar idioma" } }}
            />
          )}
        />
        {selecao.length > 0 && (
          <Stack spacing={2}>
            <Typography variant="subtitle2">Níveis</Typography>
            {selecao.map((item) => (
              <Stack
                key={item.id}
                direction={{ xs: "column", sm: "row" }}
                spacing={{ xs: 1, sm: 2 }}
                sx={{ alignItems: { sm: "center" } }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {item.nome}
                </Typography>
                <TextField
                  select
                  label="Nível"
                  value={item.nivel}
                  onChange={(e) => setNivel(item.id, e.target.value as NivelIdioma)}
                  fullWidth
                  disabled={saving}
                  sx={{ maxWidth: { sm: 240 } }}
                  slotProps={{
                    htmlInput: { "aria-label": `Nível de ${item.nome}` },
                  }}
                >
                  {NIVEL_IDIOMA_OPCOES.map((nivel) => (
                    <MenuItem key={nivel} value={nivel}>
                      {NIVEL_IDIOMA_LABELS[nivel]}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </FormDialog>
  );
}
