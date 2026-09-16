"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import AddOutlined from "@mui/icons-material/AddOutlined";
import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Pagination,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { adminApi } from "@/lib/admin";
import { getApiErrorMessage } from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";
import {
  normalizeEmailInput,
  normalizePhone,
  normalizeWhitespace,
  sanitizeCityName,
  sanitizePersonName,
  validateBrazilianPhone,
  validateCityName,
  validateCompanyName,
  validateEmail,
  validateJobTitle,
  validatePersonName,
  validateUF,
} from "@/lib/validation";
import type { AdminRecruiter, AdminRecruiterDetail } from "@/types/admin";

function useLoad<T>(
  loader: () => Promise<T>,
  dependencies: readonly unknown[],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  const key = JSON.stringify(dependencies);
  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    loaderRef
      .current()
      .then(setData)
      .catch((reason) =>
        setError(
          getApiErrorMessage(reason, "Não foi possível carregar os dados."),
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    let active = true;
    loaderRef
      .current()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((reason) => {
        if (active)
          setError(
            getApiErrorMessage(reason, "Não foi possível carregar os dados."),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key]);
  return { data, loading, error, reload };
}

function Status({ status }: { status: AdminRecruiter["status"] }) {
  return (
    <Chip
      size="small"
      color={status === "ATIVO" ? "success" : "default"}
      label={status === "ATIVO" ? "Ativo" : "Bloqueado"}
    />
  );
}

function ConfirmationDialog({
  open,
  title,
  text,
  busy,
  danger = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  text: string;
  busy: boolean;
  danger?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography>{text}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color={danger ? "error" : "primary"}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Processando..." : "Confirmar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function RecruiterCreateDialog({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const empty = {
    nomeCompleto: "",
    email: "",
    empresa: "",
    cargo: "",
    telefone: "",
    cidade: "",
    uf: "",
  };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const validation =
      validatePersonName(form.nomeCompleto) ??
      validateEmail(form.email) ??
      validateCompanyName(form.empresa) ??
      validateJobTitle(form.cargo) ??
      validateBrazilianPhone(form.telefone) ??
      validateCityName(form.cidade) ??
      validateUF(form.uf);
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminApi.createRecruiter({
        nomeCompleto: normalizeWhitespace(form.nomeCompleto),
        email: normalizeEmailInput(form.email),
        empresa: normalizeWhitespace(form.empresa),
        cargo: normalizeWhitespace(form.cargo),
        telefone: normalizePhone(form.telefone),
        cidade: normalizeWhitespace(form.cidade),
        uf: form.uf.trim().toUpperCase(),
      });
      setForm(empty);
      onSuccess();
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
      maxWidth="sm"
    >
      <Box component="form" onSubmit={submit} noValidate>
        <DialogTitle>Criar acesso de recrutador</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {[
              ["nomeCompleto", "Nome completo", "text"],
              ["email", "E-mail", "email"],
              ["empresa", "Empresa", "text"],
              ["cargo", "Cargo", "text"],
              ["telefone", "Telefone", "tel"],
              ["cidade", "Cidade", "text"],
              ["uf", "UF", "text"],
            ].map(([key, label, type]) => (
              <TextField
                key={key}
                required
                label={label}
                type={type}
                value={form[key as keyof typeof form]}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    [key]:
                      key === "telefone"
                        ? normalizePhone(event.target.value)
                        : key === "uf"
                          ? event.target.value.toUpperCase().slice(0, 2)
                          : key === "nomeCompleto"
                            ? sanitizePersonName(event.target.value)
                            : key === "cidade"
                              ? sanitizeCityName(event.target.value)
                              : event.target.value,
                  }))
                }
                slotProps={{
                  htmlInput: {
                    maxLength:
                      key === "uf"
                        ? 2
                        : key === "telefone"
                          ? 11
                          : key === "email"
                            ? 254
                            : key === "cidade"
                              ? 120
                              : 150,
                    inputMode: key === "telefone" ? "tel" : undefined,
                  },
                }}
              />
            ))}
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

function RecruiterDetailDialog({
  detail,
  onClose,
}: {
  detail: AdminRecruiterDetail | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!detail} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Detalhes do recrutador</DialogTitle>
      <DialogContent>
        {detail && (
          <Stack spacing={1}>
            <Typography variant="h6">{detail.nomeCompleto}</Typography>
            {[
              ["E-mail", detail.email],
              ["Empresa", detail.empresa],
              ["Cargo", detail.cargo],
              ["Telefone", detail.telefone],
              ["Localização", `${detail.cidade}/${detail.uf}`],
              [
                "Último acesso",
                detail.ultimoAcessoEm
                  ? formatUpdatedAt(detail.ultimoAcessoEm)
                  : "Não informado",
              ],
            ].map(([label, value]) => (
              <Typography key={label}>
                <strong>{label}:</strong> {value}
              </Typography>
            ))}
            <Status status={detail.status} />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}

export function AdminRecruitersDeletionView() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(""),
    [status, setStatus] = useState(""),
    [detail, setDetail] = useState<AdminRecruiterDetail | null>(null),
    [create, setCreate] = useState(false),
    [target, setTarget] = useState<AdminRecruiter | null>(null),
    [deleteTarget, setDeleteTarget] = useState<AdminRecruiter | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string | null>(null);
  const state = useLoad(
    () => adminApi.recruiters(page, search, status),
    [page, search, status],
  );
  const showDetail = (id: string) =>
    adminApi
      .recruiter(id)
      .then(setDetail)
      .catch((reason) =>
        setNotice(
          getApiErrorMessage(reason, "Não foi possível carregar os detalhes."),
        ),
      );
  const updateStatus = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await adminApi.recruiterAction(
        target.id,
        target.status === "ATIVO" ? "bloquear" : "reativar",
      );
      setTarget(null);
      setNotice("Situação do recrutador atualizada.");
      state.reload();
    } catch (reason) {
      setNotice(
        getApiErrorMessage(reason, "Não foi possível concluir a ação."),
      );
    } finally {
      setBusy(false);
    }
  };
  const removeRecruiter = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await adminApi.deleteRecruiter(deleteTarget.id);
      setDeleteTarget(null);
      setNotice("Recrutador excluído permanentemente.");
      state.reload();
    } catch (reason) {
      setNotice(
        getApiErrorMessage(reason, "Não foi possível excluir o recrutador."),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack spacing={2.5}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
          <Typography component="h1" variant="h4">
            Recrutadores
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddOutlined />}
            onClick={() => setCreate(true)}
          >
            Criar acesso de recrutador
          </Button>
        </Stack>
        <Stack
          component="form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            setPage(1);
            setSearch(draft.trim());
          }}
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
        >
          <TextField
            fullWidth
            size="small"
            label="Buscar nome ou empresa"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <TextField
            select
            size="small"
            label="Situação"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="ATIVO">Ativos</MenuItem>
            <MenuItem value="BLOQUEADO">Bloqueados</MenuItem>
          </TextField>
          <Button type="submit" variant="outlined">
            Buscar
          </Button>
        </Stack>
        {state.loading && (
          <Stack spacing={1.5}>
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} variant="rounded" height={100} />
            ))}
          </Stack>
        )}
        {state.error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={state.reload}>
                Tentar novamente
              </Button>
            }
          >
            {state.error}
          </Alert>
        )}
        {state.data && (
          <>
            <Stack spacing={1.5}>
              {state.data.items.map((recruiter) => (
                <Paper
                  key={recruiter.id}
                  elevation={0}
                  sx={{ p: 2, border: 1, borderColor: "divider" }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={2}
                    sx={{
                      justifyContent: "space-between",
                      alignItems: { sm: "center" },
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 700 }}>
                        {recruiter.nomeCompleto}
                      </Typography>
                      <Typography color="text.secondary" variant="body2">
                        {recruiter.empresa} · {recruiter.cargo} ·{" "}
                        {recruiter.cidade}/{recruiter.uf}
                      </Typography>
                      <Typography color="text.secondary" variant="caption">
                        Último acesso:{" "}
                        {recruiter.ultimoAcessoEm
                          ? formatUpdatedAt(recruiter.ultimoAcessoEm)
                          : "não informado"}
                      </Typography>
                    </Box>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ alignItems: "center", flexWrap: "wrap" }}
                    >
                      <Status status={recruiter.status} />
                      <Button
                        size="small"
                        onClick={() => void showDetail(recruiter.id)}
                      >
                        Detalhes
                      </Button>
                      <Button
                        size="small"
                        color={
                          recruiter.status === "ATIVO" ? "warning" : "success"
                        }
                        onClick={() => setTarget(recruiter)}
                      >
                        {recruiter.status === "ATIVO" ? "Bloquear" : "Reativar"}
                      </Button>
                      {recruiter.status === "BLOQUEADO" && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => setDeleteTarget(recruiter)}
                        >
                          Excluir
                        </Button>
                      )}
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
            {state.data.items.length === 0 && (
              <Typography color="text.secondary">
                Nenhum recrutador encontrado.
              </Typography>
            )}
            {state.data.totalPages > 1 && (
              <Pagination
                page={state.data.page}
                count={state.data.totalPages}
                onChange={(_, nextPage) => setPage(nextPage)}
              />
            )}
          </>
        )}
        <RecruiterCreateDialog
          open={create}
          onClose={() => setCreate(false)}
          onSuccess={() => {
            setCreate(false);
            setNotice(
              "Acesso de recrutador criado. A ativação seguirá o fluxo existente.",
            );
            state.reload();
          }}
        />
        <RecruiterDetailDialog
          detail={detail}
          onClose={() => setDetail(null)}
        />
        <ConfirmationDialog
          open={!!target}
          title={
            target?.status === "ATIVO"
              ? "Bloquear recrutador?"
              : "Reativar recrutador?"
          }
          text={
            target?.status === "ATIVO"
              ? `Bloquear ${target.nomeCompleto}? A conta será excluída automaticamente em 30 dias, salvo se for reativada.`
              : `Deseja reativar ${target?.nomeCompleto}? A exclusão automática será cancelada.`
          }
          busy={busy}
          onClose={() => setTarget(null)}
          onConfirm={() => void updateStatus()}
        />
        <ConfirmationDialog
          open={!!deleteTarget}
          title="Excluir recrutador permanentemente?"
          text={`A exclusão de ${deleteTarget?.nomeCompleto} é permanente e não poderá ser desfeita.`}
          busy={busy}
          danger
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => void removeRecruiter()}
        />
        <Snackbar
          open={!!notice}
          autoHideDuration={5000}
          onClose={() => setNotice(null)}
          message={notice}
        />
      </Stack>
    </Container>
  );
}
