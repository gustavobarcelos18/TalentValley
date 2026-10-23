"use client";

import { useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Snackbar, Stack, TextField, Typography } from "@mui/material";
import AddOutlined from "@mui/icons-material/AddOutlined";
import SchoolOutlined from "@mui/icons-material/SchoolOutlined";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { EmptyState } from "@/components/common/EmptyState";
import { adminApi } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";
import { normalizeEmailInput, sanitizePersonName, stripEmoji, stripEmojiOnPaste, validateEmail, validatePersonName, validateSearchTerm } from "@/lib/validation";
import { ProtectedTalentPhoto } from "@/components/recruiter/ProtectedTalentPhoto";
import { ActivationSnackbar, useActivationFeedback } from "@/components/admin/activationFeedback";
import type { AdminStudentCreated, AdminStudentListItem } from "@/types/admin";
import { useLoad } from "@/components/admin/useLoad";
import { Page, LoadState, AdminRow, SearchCard, fieldOnWash, Status, Pager, Confirm } from "@/components/admin/adminShared";

export function AdminStudentsView() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(""),
    [create, setCreate] = useState(false),
    [target, setTarget] = useState<AdminStudentListItem | null>(null),
    [deleteTarget, setDeleteTarget] = useState<AdminStudentListItem | null>(
      null,
    ),
    [busy, setBusy] = useState(false),
    [searchError, setSearchError] = useState<string | null>(null),
    [confirmError, setConfirmError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const activation = useActivationFeedback();
  const state = useLoad(() => adminApi.students(page, search), [page, search]);
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const validation = validateSearchTerm(draft);
    setSearchError(validation);
    if (validation) return;
    setPage(1);
    setSearch(draft.trim());
  };
  const mutate = async (action: "bloquear" | "reativar") => {
    if (!target || busy) return;
    setBusy(true);
    setConfirmError(null);
    try {
      await adminApi.studentAction(target.id, action);
      setNotice(`Aluno ${action === "bloquear" ? "bloqueado" : "reativado"}.`);
      setTarget(null);
      state.reload();
    } catch (e) {
      setConfirmError(
        getApiErrorMessage(e, "Não foi possível concluir a ação."),
      );
    } finally {
      setBusy(false);
    }
  };
  const removeStudent = async () => {
    if (!deleteTarget || busy) return;
    setBusy(true);
    setConfirmError(null);
    try {
      await adminApi.deleteStudent(deleteTarget.id);
      setNotice("Aluno excluído permanentemente.");
      setDeleteTarget(null);
      if (state.data && state.data.items.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        state.reload();
      }
    } catch (e) {
      setConfirmError(
        getApiErrorMessage(e, "Não foi possível excluir o aluno."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page
      title="Alunos"
      description="Pesquise, consulte e gerencie o acesso dos alunos."
      action={
        <Button
          variant="contained"
          startIcon={<AddOutlined />}
          onClick={() => setCreate(true)}
        >
          Criar acesso de aluno
        </Button>
      }
    >
      <SearchCard onSubmit={submitSearch}>
        <TextField
          fullWidth
          label="Buscar por nome"
          value={draft}
          onChange={(e) => setDraft(stripEmoji(e.target.value).slice(0, 150))}
          error={Boolean(searchError)}
          helperText={searchError}
          slotProps={{
            htmlInput: { maxLength: 150, onPaste: stripEmojiOnPaste },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined color="action" />
                </InputAdornment>
              ),
            },
          }}
          sx={fieldOnWash}
        />
      </SearchCard>
      <LoadState {...state} />
      {!state.loading && !state.error && state.data && (
        <>
          <Stack spacing={1.5}>
            {state.data.items.map((x, index) => (
              <AdminRow key={x.id} index={index}>
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={2}
                  sx={{
                    alignItems: { md: "center" },
                    justifyContent: "space-between",
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0 }}>
                    <ProtectedTalentPhoto path={x.fotoUrl} name={x.nomeCompleto} size={52} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{x.nomeCompleto}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {[x.cidade, x.uf].filter(Boolean).join(" / ") || "Localização não informada"} · Atualizado{" "}
                        {formatUpdatedAt(x.atualizadoEm)}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }} useFlexGap>
                    <Status active={x.ativo} />
                    <Button component={Link} href={`/admin/alunos/${x.id}`} size="small" variant="outlined">
                      Ver perfil
                    </Button>
                    <Button
                      size="small"
                      color={x.ativo ? "warning" : "success"}
                      onClick={() => {
                        setConfirmError(null);
                        setTarget(x);
                      }}
                    >
                      {x.ativo ? "Bloquear" : "Reativar"}
                    </Button>
                    {!x.ativo && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => {
                          setConfirmError(null);
                          setDeleteTarget(x);
                        }}
                      >
                        Excluir
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </AdminRow>
            ))}
          </Stack>
          {state.data.items.length === 0 && (
            <EmptyState
              icon={<SchoolOutlined />}
              title="Nenhum aluno encontrado."
              description={search ? "Tente buscar por outro nome." : "Os alunos cadastrados aparecem aqui."}
            />
          )}
          <Pager data={state.data} setPage={setPage} />
        </>
      )}
      <StudentCreate
        open={create}
        onClose={() => setCreate(false)}
        onSuccess={(created) => {
          setCreate(false);
          activation.reportCreated(
            created.id,
            created.activationSent,
            "Acesso de aluno criado e email de ativação enviado.",
          );
          state.reload();
        }}
      />
      <Confirm
        open={target !== null}
        title={target?.ativo ? "Bloquear aluno?" : "Reativar aluno?"}
        text={
          target?.ativo
            ? `Bloquear ${target.nomeCompleto}? O aluno perderá o acesso à conta e poderá ser reativado ou excluído permanentemente posteriormente.`
            : `Deseja reativar ${target?.nomeCompleto}? O acesso à conta será restaurado.`
        }
        busy={busy}
        onClose={() => {
          setConfirmError(null);
          setTarget(null);
        }}
        error={confirmError}
        confirm={() => void mutate(target?.ativo ? "bloquear" : "reativar")}
      />
      <Confirm
        open={deleteTarget !== null}
        title="Excluir aluno permanentemente?"
        text={`A exclusão de ${deleteTarget?.nomeCompleto} é permanente e não poderá ser desfeita.`}
        busy={busy}
        onClose={() => {
          setConfirmError(null);
          setDeleteTarget(null);
        }}
        error={confirmError}
        confirm={() => void removeStudent()}
        danger
      />
      <Snackbar
        open={!!notice}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        message={notice}
      />
      <ActivationSnackbar
        notice={activation.notice}
        busy={activation.resendBusy}
        onClose={() => activation.setNotice(null)}
        onResend={() => void activation.resend()}
      />
    </Page>
  );
}

function StudentCreate({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (created: AdminStudentCreated) => void;
}) {
  const [nomeCompleto, setName] = useState(""),
    [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const validation = validatePersonName(nomeCompleto) ?? validateEmail(email);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await adminApi.createStudent({
        nomeCompleto: nomeCompleto.trim(),
        email: normalizeEmailInput(email),
      });
      setName("");
      setEmail("");
      onSuccess(created);
    } catch (reason) {
      setError(getApiErrorMessage(reason, "Não foi possível criar o acesso."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby={titleId}
    >
      <Box component="form" noValidate onSubmit={submit}>
        <DialogTitle id={titleId}>Criar acesso de aluno</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              required
              label="Nome completo"
              value={nomeCompleto}
              onChange={(e) => setName(sanitizePersonName(e.target.value))}
              slotProps={{ htmlInput: { maxLength: 150, onPaste: stripEmojiOnPaste } }}
            />
            <TextField
              required
              type="email"
              label="E-mail"
              value={email}
              onChange={(e) => setEmail(stripEmoji(e.target.value).slice(0, 254))}
              slotProps={{ htmlInput: { maxLength: 254, onPaste: stripEmojiOnPaste } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "Criando..." : "Criar acesso"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
