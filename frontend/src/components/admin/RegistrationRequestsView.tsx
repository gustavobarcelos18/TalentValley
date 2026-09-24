"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
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
import { TIPO_FORMACAO_LABELS } from "@/lib/labels";
import { stripEmoji, validateSearchTerm } from "@/lib/validation";
import type {
  AdminRegistrationRequest,
  AdminRegistrationRequestDetail,
  RegistrationRequestStatus,
  RegistrationRequestType,
} from "@/types/admin";

const statusLabel: Record<RegistrationRequestStatus, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  REJEITADA: "Rejeitada",
};
export function RegistrationRequestsView() {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(""),
    [type, setType] = useState<RegistrationRequestType | "">(""),
    [status, setStatus] = useState<RegistrationRequestStatus | "">("PENDENTE"),
    [items, setItems] = useState<AdminRegistrationRequest[] | null>(null),
    [totalPages, setTotalPages] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState<string | null>(null),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [detail, setDetail] = useState<AdminRegistrationRequestDetail | null>(null),
    [detailLoading, setDetailLoading] = useState(false),
    [detailError, setDetailError] = useState<string | null>(null),
    [actionError, setActionError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [searchError, setSearchError] = useState<string | null>(null),
    [rejectionOpen, setRejectionOpen] = useState(false),
    [reason, setReason] = useState(""),
    [notice, setNotice] = useState<string | null>(null);
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const rejectionTitleId = useId();
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // Single request lifecycle for the list. Each call bumps an identity so a
  // slower, obsolete response can never replace newer search/filter/page data.
  const runList = useCallback(
    async (targetPage: number, requestId: number) => {
      try {
        const data = await adminApi.registrationRequests(
          targetPage,
          search,
          type,
          status,
        );
        if (mountedRef.current && requestId === listRequestRef.current) {
          setItems(data.items);
          setTotalPages(data.totalPages);
        }
        return data;
      } catch (cause) {
        if (mountedRef.current && requestId === listRequestRef.current)
          setError(
            getApiErrorMessage(
              cause,
              "Não foi possível carregar as solicitações.",
            ),
          );
        return null;
      } finally {
        if (mountedRef.current && requestId === listRequestRef.current)
          setLoading(false);
      }
    },
    [search, status, type],
  );
  // Reset the loading/error flags during render when the query changes, then
  // kick the request off from the effect without a synchronous state update.
  const queryKey = JSON.stringify([page, search, type, status]);
  const [prevQueryKey, setPrevQueryKey] = useState(queryKey);
  if (queryKey !== prevQueryKey) {
    setPrevQueryKey(queryKey);
    setLoading(true);
    setError(null);
  }
  useEffect(() => {
    listRequestRef.current += 1;
    void runList(page, listRequestRef.current);
  }, [runList, page]);
  const reload = useCallback(() => {
    listRequestRef.current += 1;
    setLoading(true);
    setError(null);
    void runList(page, listRequestRef.current);
  }, [runList, page]);
  const open = useCallback((id: string) => {
    const requestId = ++detailRequestRef.current;
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    setActionError(null);
    setReason("");
    adminApi
      .registrationRequest(id)
      .then((data) => {
        if (mountedRef.current && requestId === detailRequestRef.current)
          setDetail(data);
      })
      .catch((cause) => {
        if (mountedRef.current && requestId === detailRequestRef.current)
          setDetailError(
            getApiErrorMessage(cause, "Não foi possível abrir a solicitação."),
          );
      })
      .finally(() => {
        if (mountedRef.current && requestId === detailRequestRef.current)
          setDetailLoading(false);
      });
  }, []);
  const retryDetail = useCallback(() => {
    if (selectedId) open(selectedId);
  }, [open, selectedId]);
  const closeDetail = useCallback(() => {
    detailRequestRef.current += 1;
    setSelectedId(null);
    setDetail(null);
    setDetailLoading(false);
    setDetailError(null);
    setActionError(null);
    setReason("");
  }, []);
  // After a successful mutation the processed row may leave the current page
  // empty; fall back to the previous page in that case.
  const refreshAfterMutation = useCallback(async () => {
    const requestId = ++listRequestRef.current;
    setLoading(true);
    setError(null);
    const data = await runList(page, requestId);
    if (data && data.items.length === 0 && page > 1) setPage(page - 1);
  }, [runList, page]);
  const approve = async () => {
    if (!detail || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await adminApi.approveRegistration(detail.id);
      setNotice(
        "Cadastro aprovado. A ativação foi encaminhada pelo fluxo existente.",
      );
      closeDetail();
      await refreshAfterMutation();
    } catch (cause) {
      setActionError(
        getApiErrorMessage(cause, "Não foi possível aprovar o cadastro."),
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const reject = async () => {
    if (!detail || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setActionError(null);
    try {
      await adminApi.rejectRegistration(detail.id, reason.trim() || undefined);
      setNotice("Solicitação rejeitada.");
      setRejectionOpen(false);
      closeDetail();
      await refreshAfterMutation();
    } catch (cause) {
      setActionError(
        getApiErrorMessage(cause, "Não foi possível rejeitar a solicitação."),
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const startRejection = () => {
    setActionError(null);
    setRejectionOpen(true);
  };
  const cancelRejection = () => {
    setActionError(null);
    setRejectionOpen(false);
  };
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 4 } }}>
      <Stack spacing={2.5}>
        <Stack spacing={0.5}>
          <Typography component="h1" variant="h4">
            Solicitações de cadastro
          </Typography>
          <Typography color="text.secondary">
            Analise pedidos de acesso antes de criar uma conta no Talent Valley.
          </Typography>
        </Stack>
        <Stack
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            const validation = validateSearchTerm(draft);
            setSearchError(validation);
            if (validation) return;
            setPage(1);
            setSearch(draft.trim());
          }}
          direction={{ xs: "column", md: "row" }}
          spacing={1}
        >
          <TextField
            fullWidth
            size="small"
            label="Buscar nome, e-mail, empresa, instituição ou curso"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 150))}
            error={Boolean(searchError)}
            helperText={searchError}
            slotProps={{ htmlInput: { maxLength: 150 } }}
          />
          <TextField
            select
            size="small"
            label="Tipo"
            value={type}
            onChange={(e) => {
              setPage(1);
              setType(e.target.value as RegistrationRequestType | "");
            }}
            sx={{ minWidth: 145 }}
          >
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="ALUNO">Alunos</MenuItem>
            <MenuItem value="RECRUTADOR">Recrutadores</MenuItem>
          </TextField>
          <TextField
            select
            size="small"
            label="Status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as RegistrationRequestStatus | "");
            }}
            sx={{ minWidth: 145 }}
          >
            <MenuItem value="">Todos</MenuItem>
            <MenuItem value="PENDENTE">Pendentes</MenuItem>
            <MenuItem value="APROVADA">Aprovadas</MenuItem>
            <MenuItem value="REJEITADA">Rejeitadas</MenuItem>
          </TextField>
          <Button type="submit" variant="outlined">
            Buscar
          </Button>
        </Stack>
        {loading && (
          <Stack spacing={1.5}>
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} variant="rounded" height={110} />
            ))}
          </Stack>
        )}
        {error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={reload}>
                Tentar novamente
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {!loading && !error && items && (
          <>
            <Stack spacing={1.5}>
              {items.map((request) => (
                <RequestCard key={request.id} request={request} onOpen={open} />
              ))}
            </Stack>
            {items.length === 0 && (
              <Typography color="text.secondary">
                Nenhuma solicitação encontrada para os filtros selecionados.
              </Typography>
            )}
            {totalPages > 1 && (
              <Pagination
                page={page}
                count={totalPages}
                onChange={(_, next) => setPage(next)}
              />
            )}
          </>
        )}
        <DetailDialog
          open={selectedId !== null}
          loading={detailLoading}
          error={detailError}
          actionError={actionError}
          detail={detail}
          busy={busy}
          onClose={closeDetail}
          onRetry={retryDetail}
          onApprove={() => void approve()}
          onReject={startRejection}
        />
        <Dialog
          open={rejectionOpen}
          onClose={busy ? undefined : cancelRejection}
          fullWidth
          maxWidth="xs"
          aria-labelledby={rejectionTitleId}
        >
          <DialogTitle id={rejectionTitleId}>Rejeitar solicitação</DialogTitle>
          <DialogContent>
            {actionError && (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {actionError}
              </Alert>
            )}
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Motivo (opcional)"
              value={reason}
              onChange={(e) =>
                setReason(stripEmoji(e.target.value).slice(0, 500))
              }
              disabled={busy}
              slotProps={{ htmlInput: { maxLength: 500 } }}
              sx={{ mt: 1 }}
            />
          </DialogContent>
          <DialogActions>
            <Button disabled={busy} onClick={cancelRejection}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              color="error"
              disabled={busy}
              onClick={() => void reject()}
            >
              {busy ? "Rejeitando..." : "Rejeitar"}
            </Button>
          </DialogActions>
        </Dialog>
        <Snackbar
          open={!!notice}
          autoHideDuration={6000}
          onClose={() => setNotice(null)}
          message={notice}
        />
      </Stack>
    </Container>
  );
}
function RequestCard({
  request,
  onOpen,
}: {
  request: AdminRegistrationRequest;
  onOpen: (id: string) => void;
}) {
  const student = request.tipo === "ALUNO";
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.25,
        border: 1,
        borderColor:
          request.status === "PENDENTE" ? "primary.light" : "divider",
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ justifyContent: "space-between", alignItems: { md: "center" } }}
      >
        <Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", mb: 0.5 }}
          >
            <Typography sx={{ fontWeight: 700 }}>
              {request.nomeCompleto}
            </Typography>
            <Chip
              size="small"
              color={
                request.status === "PENDENTE"
                  ? "warning"
                  : request.status === "APROVADA"
                    ? "success"
                    : "default"
              }
              label={statusLabel[request.status]}
            />
            <Chip
              size="small"
              variant="outlined"
              label={student ? "Aluno" : "Recrutador"}
            />
          </Stack>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ overflowWrap: "anywhere" }}
          >
            {request.email} · {request.telefone} · {request.cidade}/{request.uf}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ overflowWrap: "anywhere" }}
          >
            {student
              ? `${request.instituicaoEnsino} · ${request.curso}${request.tipoFormacao ? ` · ${TIPO_FORMACAO_LABELS[request.tipoFormacao]}` : ""}`
              : `${request.empresa} · ${request.cargo}`}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Solicitada {formatUpdatedAt(request.criadoEm)}
          </Typography>
        </Box>
        <Button onClick={() => onOpen(request.id)}>Ver detalhes</Button>
      </Stack>
    </Paper>
  );
}
function DetailDialog({
  open,
  loading,
  error,
  actionError,
  detail,
  busy,
  onClose,
  onRetry,
  onApprove,
  onReject,
}: {
  open: boolean;
  loading: boolean;
  error: string | null;
  actionError: string | null;
  detail: AdminRegistrationRequestDetail | null;
  busy: boolean;
  onClose: () => void;
  onRetry: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const titleId = useId();
  const contentId = useId();
  const student = detail?.tipo === "ALUNO";
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
      aria-labelledby={titleId}
      aria-describedby={contentId}
    >
      <DialogTitle id={titleId}>Detalhes da solicitação</DialogTitle>
      <DialogContent id={contentId}>
        {loading && (
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <Skeleton variant="text" sx={{ fontSize: "1.5rem" }} />
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="50%" />
            <Skeleton variant="rounded" height={64} />
          </Stack>
        )}
        {!loading && error && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" onClick={onRetry}>
                Tentar novamente
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        {!loading && !error && detail && (
          <Stack spacing={1.15} sx={{ pt: 1, minWidth: 0 }}>
            {actionError && (
              <Alert severity="error" sx={{ overflowWrap: "anywhere" }}>
                {actionError}
              </Alert>
            )}
            <Stack direction="row" spacing={1}>
              <Chip size="small" label={statusLabel[detail.status]} />
              <Chip
                size="small"
                variant="outlined"
                label={student ? "Aluno" : "Recrutador"}
              />
            </Stack>
            <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
              {detail.nomeCompleto}
            </Typography>
            {[
              ["E-mail", detail.email],
              ["Telefone", detail.telefone],
              ["Localização", `${detail.cidade}/${detail.uf}`],
              ["Enviada em", formatUpdatedAt(detail.criadoEm)],
              ...(student
                ? [
                    ["Instituição", detail.instituicaoEnsino],
                    ["Curso", detail.curso],
                    [
                      "Tipo de formação",
                      detail.tipoFormacao
                        ? TIPO_FORMACAO_LABELS[detail.tipoFormacao]
                        : null,
                    ],
                    ["Ano previsto", detail.anoConclusaoPrevisto],
                    ["Relação RPV", detail.relacaoRioPombaValley],
                  ]
                : [
                    ["Empresa", detail.empresa],
                    ["Cargo", detail.cargo],
                    ["Site", detail.siteEmpresa],
                  ]),
            ].map(([label, value]) =>
              value ? (
                <Typography
                  key={String(label)}
                  sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                >
                  <strong>{label}:</strong> {value}
                </Typography>
              ) : null,
            )}
            {detail.analisadoEm && (
              <Typography sx={{ overflowWrap: "anywhere" }}>
                <strong>Analisada em:</strong>{" "}
                {formatUpdatedAt(detail.analisadoEm)}
                {detail.adminEmail ? ` por ${detail.adminEmail}` : ""}
              </Typography>
            )}
            {detail.motivoRejeicao && (
              <Alert severity="info" sx={{ overflowWrap: "anywhere" }}>
                Motivo da rejeição: {detail.motivoRejeicao}
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Fechar
        </Button>
        {!loading && !error && detail?.status === "PENDENTE" && (
          <>
            <Button color="error" disabled={busy} onClick={onReject}>
              Rejeitar cadastro
            </Button>
            <Button variant="contained" disabled={busy} onClick={onApprove}>
              {busy ? "Aprovando..." : "Aprovar cadastro"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
